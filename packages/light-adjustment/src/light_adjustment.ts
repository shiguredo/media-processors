import { VideoTrackProcessor } from "@shiguredo/video-track-processor";

const LIGHT_ADJUSTMENT_WASM = "__LIGHT_ADJUSTMENT_WASM__";

interface LightAdjustmentProcessorOptions {
  alpha?: number;
  fusion?: number;
  minIntensity?: number;
  maxIntensity?: number;
  entropyThreshold?: number;
}

const DEFAULT_OPTIONS: LightAdjustmentProcessorOptions = {
  alpha: 0.5,
  fusion: 0.5,
  minIntensity: 10,
  maxIntensity: 255,
  entropyThreshold: 0.05,
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
  private isStateObsolete = false;
  private stats: LightAdjustmentStats;

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
  }

  processImage(image: ImageData) {
    const { width, height } = image;
    const imageDataSize = width * height * 4;
    this.resizeImageIfNeed(imageDataSize);
    new Uint8Array(this.memory.buffer, this.imageDataPtr, this.imageDataSize).set(image.data);

    this.updateStateIfNeed();
    (this.wasm.exports.agcwdEnhanceImage as CallableFunction)(this.agcwdPtr, this.imagePtr);
    image.data.set(new Uint8Array(this.memory.buffer, this.imageDataPtr, this.imageDataSize));
  }

  setOptions(options: LightAdjustmentProcessorOptions): void {
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

  private updateStateIfNeed(): void {
    const isStateObsolete = this.wasm.exports.agcwdIsStateObsolete as CallableFunction;
    if (this.isStateObsolete || (isStateObsolete(this.agcwdPtr, this.imagePtr) as boolean)) {
      // TODO: handle mask
      (this.wasm.exports.agcwdUpdateState as CallableFunction)(this.agcwdPtr, this.imagePtr, this.imagePtr);
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
    }

    this.imageDataSize = imageDataSize;
    const imagePtr = (this.wasm.exports.imageNew as CallableFunction)(this.imageDataSize) as number;
    if (imagePtr === 0) {
      throw new Error("Failed to create WebAssembly image instance.");
    }
    this.imagePtr = imagePtr;
    this.imageDataPtr = (this.wasm.exports.imageGetDataOffset as CallableFunction)(imagePtr) as number;
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

    return this.trackProcessor.startProcessing(track, (image: ImageData) => {
      if (this.agcwd !== undefined) {
        this.stats.numberOfFrames += 1;
        const start = performance.now() / 1000;
        this.agcwd.processImage(image);
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

export { LightAdjustmentProcessor, LightAdjustmentProcessorOptions, LightAdjustmentStats };
