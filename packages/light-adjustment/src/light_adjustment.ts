import { VideoTrackProcessor } from "@shiguredo/video-track-processor";
import {
  SelfieSegmentation,
  SelfieSegmentationConfig,
  Results as SelfieSegmentationResults,
} from "@mediapipe/selfie_segmentation";

const LIGHT_ADJUSTMENT_WASM = "__LIGHT_ADJUSTMENT_WASM__";

interface FocusMask {
  getFocusMask(image: ImageData): Promise<Uint8Array>;
}

class UniformFocusMask implements FocusMask {
  private mask: Uint8Array = new Uint8Array();

  getFocusMask(image: ImageData): Promise<Uint8Array> {
    const { width, height } = image;
    if (this.mask.byteLength !== width * height) {
      this.mask = new Uint8Array(width * height);
      this.mask.fill(255);
    }
    return Promise.resolve(this.mask);
  }
}

class CenterFocusMask implements FocusMask {
  private mask: Uint8Array = new Uint8Array();

  getFocusMask(image: ImageData): Promise<Uint8Array> {
    const { width, height } = image;
    if (this.mask.byteLength !== width * height) {
      this.mask = new Uint8Array(width * height);
      this.mask.fill(0);

      const yStart = Math.floor(height / 3);
      const yEnd = yStart * 2;
      let xStart = yStart * width + Math.floor(width / 3);
      let xEnd = yStart * width + Math.floor(width / 3) * 2;
      for (let y = yStart; y < yEnd; y++, xStart += width, xEnd += width) {
        this.mask.fill(255, xStart, xEnd);
      }
    }
    return Promise.resolve(this.mask);
  }
}

class SelfieSegmentationFocusMask implements FocusMask {
  private segmentation: SelfieSegmentation;
  private mask: Uint8Array;
  private canvas: OffscreenCanvas;
  private canvasCtx: OffscreenCanvasRenderingContext2D;

  constructor(assetsPath: string) {
    this.mask = new Uint8Array();
    this.canvas = createOffscreenCanvas(0, 0) as OffscreenCanvas;
    const canvasCtx = this.canvas.getContext("2d");
    if (canvasCtx === null) {
      throw Error("Failed to create 2D canvas context");
    }
    this.canvasCtx = canvasCtx;

    const config: SelfieSegmentationConfig = {};
    assetsPath = trimLastSlash(assetsPath);
    config.locateFile = (file: string) => {
      return `${assetsPath}/${file}`;
    };
    this.segmentation = new SelfieSegmentation(config);

    const modelSelection = 1; // `1` means "landscape" mode.
    this.segmentation.setOptions({ modelSelection });
    this.segmentation.onResults((results: SelfieSegmentationResults) => {
      // TODO: メソッドに分離する
      const { width, height } = results.segmentationMask;

      if (this.canvas.width !== width || this.canvas.height !== height) {
        this.canvas.width = width;
        this.canvas.height = height;
        this.mask = new Uint8Array(width * height);
      }

      this.canvasCtx.drawImage(results.segmentationMask, 0, 0);
      const image = this.canvasCtx.getImageData(0, 0, width, height);

      for (let i = 0; i < image.data.byteLength; i += 4) {
        this.mask[i / 4] = image.data[i];
      }
    });
  }

  async getFocusMask(image: ImageData): Promise<Uint8Array> {
    // @ts-ignore TS2322: 「`image`の型が合っていない」と怒られるけれど、動作はするので一旦無視
    await this.segmentation.send({ image });
    return this.mask;
  }
}

interface LightAdjustmentProcessorOptions {
  alpha?: number;
  adjustmentLevel?: number;
  minIntensity?: number;
  maxIntensity?: number;
  entropyThreshold?: number;
  sharpnessLevel?: number;
  focusMask?: FocusMask;
}

const DEFAULT_OPTIONS: LightAdjustmentProcessorOptions = {
  alpha: 0.5,
  adjustmentLevel: 50,
  minIntensity: 10,
  maxIntensity: 255,
  entropyThreshold: 0.05,
  sharpnessLevel: 20,
  focusMask: new UniformFocusMask(),
};

class LightAdjustmentStats {
  numberOfFrames = 0;
  totalElapsedSeconds = 0;
  lastElapsedSeconds = 0;
  totalUpdateStateCount = 0;

  getAverageElapsedSeconds(): number {
    if (this.numberOfFrames === 0) {
      return 0;
    } else {
      return this.totalElapsedSeconds / this.numberOfFrames;
    }
  }

  reset(): void {
    this.numberOfFrames = 0;
    this.totalElapsedSeconds = 0;
    this.lastElapsedSeconds = 0;
    this.totalUpdateStateCount = 0;
  }
}

class WasmLightAdjustment {
  private wasm: WebAssembly.Instance;
  private memory: WebAssembly.Memory;
  private lightAdjustmentPtr: number;
  private imageDataPtr: number;
  private maskDataPtr: number;
  private imageWidth: number;
  private imageHeight: number;

  constructor(wasm: WebAssembly.Instance, track: MediaStreamVideoTrack) {
    this.wasm = wasm;
    this.memory = wasm.exports.memory as WebAssembly.Memory;

    const { width, height } = track.getSettings();
    if (width === undefined || height === undefined) {
      throw new Error("Failed to get video track resolution");
    }
    this.imageWidth = width;
    this.imageHeight = height;

    const lightAdjustmentPtr = (wasm.exports.new as CallableFunction)(width, height) as number;
    if (lightAdjustmentPtr === 0) {
      throw new Error("Failed to create WebAssembly LightAdjustment instance.");
    }
    this.lightAdjustmentPtr = lightAdjustmentPtr;
    this.imageDataPtr = (wasm.exports.getImageData as CallableFunction)(lightAdjustmentPtr) as number;
    this.maskDataPtr = (wasm.exports.getFocusMaskData as CallableFunction)(lightAdjustmentPtr) as number;
  }

  destroy(): void {
    (this.wasm.exports.free as CallableFunction)(this.lightAdjustmentPtr);
  }

  setImageData(image: ImageData): void {
    this.resizeIfNeed(image);
    new Uint8Array(this.memory.buffer, this.imageDataPtr, this.imageWidth * this.imageHeight * 4).set(image.data);
  }

  copyProcessedImageData(image: ImageData): void {
    image.data.set(new Uint8Array(this.memory.buffer, this.imageDataPtr, this.imageWidth * this.imageHeight * 4));
  }

  setFocusMaskData(data: Uint8Array): void {
    new Uint8Array(this.memory.buffer, this.maskDataPtr, this.imageWidth * this.imageHeight).set(data);
  }

  isStateObsolete(): boolean {
    return (this.wasm.exports.isStateObsolete as CallableFunction)(this.lightAdjustmentPtr) as boolean;
  }

  updateState(): boolean {
    return (this.wasm.exports.updateState as CallableFunction)(this.lightAdjustmentPtr) as boolean;
  }

  processImage(): boolean {
    return (this.wasm.exports.processImage as CallableFunction)(this.lightAdjustmentPtr) as boolean;
  }

  setOptions(options: LightAdjustmentProcessorOptions): void {
    if (options.alpha !== undefined) {
      if (!isFinite(options.alpha)) {
        throw new Error(`Invaild alpha value: ${options.alpha} (must be a finite number)`);
      }
      (this.wasm.exports.setAlpha as CallableFunction)(this.lightAdjustmentPtr, options.alpha);
    }

    if (options.adjustmentLevel !== undefined) {
      if (!(0 <= options.adjustmentLevel && options.adjustmentLevel <= 100)) {
        throw new Error(`Invaild fusion value: ${options.adjustmentLevel} (must be an integer between 0 and 100)`);
      }
      (this.wasm.exports.setAdjustmentLevel as CallableFunction)(this.lightAdjustmentPtr, options.adjustmentLevel);
    }

    if (options.sharpnessLevel !== undefined) {
      if (!(0 <= options.sharpnessLevel && options.sharpnessLevel <= 100)) {
        throw new Error(
          `Invaild sharpen level value: ${options.sharpnessLevel} (must be an integer between 0 and 100)`
        );
      }
      (this.wasm.exports.setSharpnessLevel as CallableFunction)(this.lightAdjustmentPtr, options.sharpnessLevel);
    }

    if (options.entropyThreshold !== undefined) {
      if (!(0.0 <= options.entropyThreshold && options.entropyThreshold <= 1.0)) {
        throw new Error(
          `Invaild entropyThreshold value: ${options.entropyThreshold} (must be a number between 0.0 and 1.0)`
        );
      }
      (this.wasm.exports.setEntropyThreshold as CallableFunction)(this.lightAdjustmentPtr, options.entropyThreshold);
    }

    if (options.minIntensity !== undefined) {
      if (!(0 <= options.minIntensity && options.minIntensity <= 255)) {
        throw new Error(`Invaild minIntensity value: ${options.minIntensity} (must be an integer between 0 and 255)`);
      }
      (this.wasm.exports.setMinIntensity as CallableFunction)(this.lightAdjustmentPtr, options.minIntensity);
    }

    if (options.maxIntensity !== undefined) {
      if (!(0 <= options.maxIntensity && options.maxIntensity <= 255)) {
        throw new Error(`Invaild maxIntensity value: ${options.maxIntensity} (must be an integer between 0 and 255)`);
      }
      (this.wasm.exports.setMaxIntensity as CallableFunction)(this.lightAdjustmentPtr, options.maxIntensity);
    }
  }

  private resizeIfNeed(image: ImageData): void {
    if (image.width === this.imageWidth && image.height === this.imageHeight) {
      return;
    }

    if (!((this.wasm.exports.resize as CallableFunction)(image.width, image.height) as boolean)) {
      throw new Error("Failed to resize WebAssembly image data.");
    }

    this.imageDataPtr = (this.wasm.exports.getImageData as CallableFunction)(this.lightAdjustmentPtr) as number;
    this.maskDataPtr = (this.wasm.exports.getFocusMaskData as CallableFunction)(this.lightAdjustmentPtr) as number;
    this.imageWidth = image.width;
    this.imageHeight = image.height;
  }
}

class LightAdjustmentProcessor {
  private trackProcessor: VideoTrackProcessor;
  private stats: LightAdjustmentStats;
  private wasm?: WasmLightAdjustment;
  private focusMask: FocusMask;
  private isOptionsUpdated = false;

  constructor() {
    this.trackProcessor = new VideoTrackProcessor();
    this.stats = new LightAdjustmentStats();
    this.focusMask = new UniformFocusMask();
  }

  static isSupported(): boolean {
    return VideoTrackProcessor.isSupported();
  }

  async startProcessing(
    track: MediaStreamVideoTrack,
    options: LightAdjustmentProcessorOptions = {}
  ): Promise<MediaStreamVideoTrack> {
    const wasmResults = await WebAssembly.instantiateStreaming(
      fetch("data:application/wasm;base64," + LIGHT_ADJUSTMENT_WASM),
      {}
    );

    this.wasm = new WasmLightAdjustment(wasmResults.instance, track);
    this.focusMask = new UniformFocusMask();
    this.setOptions(options);

    return this.trackProcessor.startProcessing(track, async (image: ImageData) => {
      await this.processImage(image);
      return image;
    });
  }

  private async processImage(image: ImageData): Promise<void> {
    if (this.wasm === undefined) {
      return;
    }

    this.stats.numberOfFrames += 1;
    const start = performance.now() / 1000;

    this.wasm.setImageData(image);
    if (this.isOptionsUpdated || this.wasm.isStateObsolete()) {
      const mask = await this.focusMask.getFocusMask(image);
      this.wasm.setFocusMaskData(mask);
      this.wasm.updateState();
      this.stats.totalUpdateStateCount += 1;
      this.isOptionsUpdated = false;
    }
    this.wasm.processImage();
    this.wasm.copyProcessedImageData(image);

    this.stats.lastElapsedSeconds = performance.now() / 1000 - start;
    this.stats.totalElapsedSeconds += this.stats.lastElapsedSeconds;
  }

  stopProcessing() {
    this.trackProcessor.stopProcessing();
    if (this.wasm !== undefined) {
      this.wasm.destroy();
      this.wasm = undefined;
    }
    this.resetStats();
  }

  isProcessing(): boolean {
    return this.trackProcessor.isProcessing();
  }

  getOriginalTrack(): MediaStreamVideoTrack | undefined {
    return this.trackProcessor.getOriginalTrack();
  }

  getProcessedTrack(): MediaStreamVideoTrack | undefined {
    return this.trackProcessor.getProcessedTrack();
  }

  setOptions(options: LightAdjustmentProcessorOptions): void {
    if (this.wasm !== undefined) {
      this.wasm.setOptions(options);
      if (options.focusMask !== undefined) {
        this.focusMask = options.focusMask;
      }
      this.isOptionsUpdated = true;
    }
  }

  getStats(): LightAdjustmentStats {
    return this.stats;
  }

  resetStats(): void {
    this.stats.reset();
  }
}

function createOffscreenCanvas(width: number, height: number): OffscreenCanvas | HTMLCanvasElement {
  if (typeof OffscreenCanvas === "undefined") {
    // OffscreenCanvas が使えない場合には通常の canvas で代替する
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    return canvas;
  } else {
    return new OffscreenCanvas(width, height);
  }
}

function trimLastSlash(s: string): string {
  if (s.slice(-1) === "/") {
    return s.slice(0, -1);
  }
  return s;
}

export {
  LightAdjustmentProcessor,
  LightAdjustmentProcessorOptions,
  LightAdjustmentStats,
  FocusMask,
  UniformFocusMask,
  CenterFocusMask,
  SelfieSegmentationFocusMask,
  DEFAULT_OPTIONS,
};
