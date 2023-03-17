import { VideoTrackProcessor } from "@shiguredo/video-track-processor";

const LIGHT_ADJUSTMENT_WASM = "__LIGHT_ADJUSTMENT_WASM__";

interface LightAdjustmentProcessorOptions {
  alpha?: number;
}

class LightAdjustmentStats {
  numberOfFrames = 0;
  totalElapsedSeconds = 0;
  lastElapsedSeconds = 0;

  reset(): void {
    this.numberOfFrames = 0;
    this.totalElapsedSeconds = 0;
    this.lastElapsedSeconds = 0;
  }

  getAverageElapsedSeconds(): number {
    if (this.numberOfFrames === 0) {
      return 0;
    } else {
      return this.totalElapsedSeconds / this.numberOfFrames;
    }
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

  constructor(wasm: WebAssembly.Instance, track: MediaStreamVideoTrack, options: LightAdjustmentProcessorOptions) {
    this.wasm = wasm;
    this.memory = wasm.exports.memory as WebAssembly.Memory;

    const agcwdPtr = (wasm.exports.agcwdNew as CallableFunction)() as number;
    if (agcwdPtr === 0) {
      throw new Error("Failed to create WebAssembly agcwd instance.");
    }
    this.agcwdPtr = agcwdPtr;
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
      // TODO: validation
      (this.wasm.exports.agcwdSetAlpha as CallableFunction)(this.agcwdPtr, options.alpha);
    }
  }

  private updateStateIfNeed(): void {
    const isStateObsolete = this.wasm.exports.agcwdIsStateObsolete as CallableFunction;
    if (this.isStateObsolete || (isStateObsolete(this.agcwdPtr, this.imagePtr) as boolean)) {
      // TODO: handle mask
      (this.wasm.exports.agcwdUpdateState as CallableFunction)(this.agcwdPtr, this.imagePtr, this.imagePtr);
      this.isStateObsolete = false;
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

    this.agcwd = new Agcwd(wasmResults.instance, track, options);

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
}

export { LightAdjustmentProcessor, LightAdjustmentProcessorOptions, LightAdjustmentStats };
