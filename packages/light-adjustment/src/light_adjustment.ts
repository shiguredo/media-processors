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

      // TODO: 最低値を 0 ではなく 1 にするのを試してみる (or option)
      let i = 0;
      while (i < image.data.byteLength) {
        this.mask[i / 4] = image.data[i];
        i += 4;
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
  fusion?: number;
  minIntensity?: number;
  maxIntensity?: number;
  entropyThreshold?: number;
  focusMask?: FocusMask;
}

const DEFAULT_OPTIONS: LightAdjustmentProcessorOptions = {
  alpha: 0.5,
  fusion: 0.5,
  minIntensity: 10,
  maxIntensity: 255,
  entropyThreshold: 0.05,
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

class Agcwd {
  private wasm: WebAssembly.Instance;
  private memory: WebAssembly.Memory;
  private agcwdPtr = 0;
  private imagePtr = 0;
  private imageDataSize = 0;
  private imageDataPtr = 0;
  private maskPtr = 0;
  private maskDataPtr = 0;
  private isStateObsolete = false;
  private stats: LightAdjustmentStats;
  private focusMask: FocusMask = new UniformFocusMask();

  constructor(
    wasm: WebAssembly.Instance,
    track: MediaStreamVideoTrack,
    stats: LightAdjustmentStats,
    options: LightAdjustmentProcessorOptions
  ) {
    this.wasm = wasm;
    this.memory = wasm.exports.memory as WebAssembly.Memory;
    this.stats = stats;

    const agcwdPtr = (wasm.exports.agcwdNew as CallableFunction)() as number;
    if (agcwdPtr === 0) {
      throw new Error("Failed to create WebAssembly agcwd instance.");
    }
    this.agcwdPtr = agcwdPtr;
    this.setOptions(DEFAULT_OPTIONS);
    this.setOptions(options);

    const { width, height } = track.getSettings();
    if (width === undefined || height === undefined) {
      throw new Error("Failed to get video track resolution");
    }
    this.resizeImageIfNeed(width * height * 4);
  }

  destroy(): void {
    (this.wasm.exports.agcwdFree as CallableFunction)(this.agcwdPtr);
    (this.wasm.exports.imageFree as CallableFunction)(this.imagePtr);
    (this.wasm.exports.imageFree as CallableFunction)(this.maskPtr);
  }

  async processImage(image: ImageData): Promise<void> {
    const { width, height } = image;
    const imageDataSize = width * height * 4;
    this.resizeImageIfNeed(imageDataSize);
    new Uint8Array(this.memory.buffer, this.imageDataPtr, this.imageDataSize).set(image.data);

    await this.updateStateIfNeed(image);
    (this.wasm.exports.agcwdEnhanceImage as CallableFunction)(this.agcwdPtr, this.imagePtr);
    image.data.set(new Uint8Array(this.memory.buffer, this.imageDataPtr, this.imageDataSize));
  }

  setOptions(options: LightAdjustmentProcessorOptions): void {
    if (options.focusMask !== undefined) {
      this.focusMask = options.focusMask;
    }

    this.isStateObsolete = true;

    if (options.alpha !== undefined) {
      if (options.alpha <= 0.0 || !isFinite(options.alpha)) {
        throw new Error(`Invaild alpha value: ${options.alpha} (must be a positive number)`);
      }
      (this.wasm.exports.agcwdSetAlpha as CallableFunction)(this.agcwdPtr, options.alpha);
    }

    if (options.fusion !== undefined) {
      if (!(0.0 <= options.fusion && options.fusion <= 1.0)) {
        throw new Error(`Invaild fusion value: ${options.fusion} (must be a number between 0.0 and 1.0)`);
      }
      (this.wasm.exports.agcwdSetFusion as CallableFunction)(this.agcwdPtr, options.fusion);
    }

    if (options.entropyThreshold !== undefined) {
      if (!(0.0 <= options.entropyThreshold && options.entropyThreshold <= 1.0)) {
        throw new Error(
          `Invaild entropyThreshold value: ${options.entropyThreshold} (must be a number between 0.0 and 1.0)`
        );
      }
      (this.wasm.exports.agcwdSetEntropyThreshold as CallableFunction)(this.agcwdPtr, options.entropyThreshold);
    }

    if (options.minIntensity !== undefined) {
      if (!(0 <= options.minIntensity && options.minIntensity <= 255)) {
        throw new Error(`Invaild minIntensity value: ${options.minIntensity} (must be an integer between 0 and 255)`);
      }
      (this.wasm.exports.agcwdSetMinIntensity as CallableFunction)(this.agcwdPtr, options.minIntensity);
    }

    if (options.maxIntensity !== undefined) {
      if (!(0 <= options.maxIntensity && options.maxIntensity <= 255)) {
        throw new Error(`Invaild maxIntensity value: ${options.maxIntensity} (must be an integer between 0 and 255)`);
      }
      (this.wasm.exports.agcwdSetMaxIntensity as CallableFunction)(this.agcwdPtr, options.maxIntensity);
    }
  }

  private async updateStateIfNeed(image: ImageData): Promise<void> {
    const isStateObsolete = this.wasm.exports.agcwdIsStateObsolete as CallableFunction;
    if (this.isStateObsolete || (isStateObsolete(this.agcwdPtr, this.imagePtr) as boolean)) {
      const mask = await this.focusMask.getFocusMask(image);
      new Uint8Array(this.memory.buffer, this.maskDataPtr, this.imageDataSize / 4).set(mask);
      (this.wasm.exports.agcwdUpdateState as CallableFunction)(this.agcwdPtr, this.imagePtr, this.maskPtr);

      this.isStateObsolete = false;
      this.stats.totalUpdateStateCount += 1;
    }
  }

  private resizeImageIfNeed(imageDataSize: number): void {
    if (this.imageDataSize == imageDataSize) {
      return;
    }
    if (this.imagePtr !== 0) {
      (this.wasm.exports.imageFree as CallableFunction)(this.imagePtr);
      (this.wasm.exports.imageFree as CallableFunction)(this.maskPtr);
    }

    this.imageDataSize = imageDataSize;
    const imagePtr = (this.wasm.exports.imageNew as CallableFunction)(this.imageDataSize) as number;
    if (imagePtr === 0) {
      throw new Error("Failed to create WebAssembly image instance.");
    }
    this.imagePtr = imagePtr;
    this.imageDataPtr = (this.wasm.exports.imageGetDataOffset as CallableFunction)(imagePtr) as number;

    const maskPtr = (this.wasm.exports.imageNew as CallableFunction)(this.imageDataSize / 4) as number;
    if (maskPtr === 0) {
      throw new Error("Failed to create WebAssembly mask instance.");
    }
    this.maskPtr = maskPtr;
    this.maskDataPtr = (this.wasm.exports.maskGetDataOffset as CallableFunction)(maskPtr) as number;
  }
}

class LightAdjustmentProcessor {
  private trackProcessor: VideoTrackProcessor;
  private stats: LightAdjustmentStats;
  private agcwd?: Agcwd;

  constructor() {
    this.trackProcessor = new VideoTrackProcessor();
    this.stats = new LightAdjustmentStats();
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

    this.agcwd = new Agcwd(wasmResults.instance, track, this.stats, options);

    return this.trackProcessor.startProcessing(track, async (image: ImageData) => {
      if (this.agcwd !== undefined) {
        this.stats.numberOfFrames += 1;
        const start = performance.now() / 1000;
        await this.agcwd.processImage(image);
        this.stats.lastElapsedSeconds = performance.now() / 1000 - start;
        this.stats.totalElapsedSeconds += this.stats.lastElapsedSeconds;
      }
      return Promise.resolve(image);
    });
  }

  stopProcessing() {
    this.trackProcessor.stopProcessing();
    if (this.agcwd !== undefined) {
      this.agcwd.destroy();
      this.agcwd = undefined;
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
    if (this.agcwd !== undefined) {
      this.agcwd.setOptions(options);
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
  SelfieSegmentationFocusMask,
};
