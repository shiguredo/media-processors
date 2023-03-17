import { VideoTrackProcessor } from "@shiguredo/video-track-processor";

const LIGHT_ADJUSTMENT_WASM = "__LIGHT_ADJUSTMENT_WASM__";

interface LightAdjustmentProcessorOptions {
  alpha?: number;
}

const DEFAULT_ALPHA = 0.5;

class Agcwd {
  private wasm: WebAssembly.Instance;
  private memory: WebAssembly.Memory;
  private agcwdPtr = 0;
  private imagePtr = 0;
  private imageDataSize = 0;
  private imageDataPtr = 0;

  constructor(wasm: WebAssembly.Instance, track: MediaStreamVideoTrack, options: LightAdjustmentProcessorOptions) {
    this.wasm = wasm;
    this.memory = wasm.exports.memory as WebAssembly.Memory;

    const agcwdPtr = (wasm.exports.agcwdNew as CallableFunction)() as number | undefined;
    if (agcwdPtr === undefined) {
      // TODO: zig で null ptr を返した時の挙動を確認する
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

  setOptions(optiosn: LightAdjustmentProcessorOptions): void {
    const alpha = optiosn.alpha || DEFAULT_ALPHA;
    (this.wasm.exports.agcwdSetAlpha as CallableFunction)(this.agcwdPtr, alpha);
  }

  private updateStateIfNeed(): void {
    const isStateObsolete = this.wasm.exports.agcwdIsStateObsolete as CallableFunction;
    if (isStateObsolete(this.agcwdPtr, this.imagePtr) as boolean) {
      // TODO: handle mask
      (this.wasm.exports.agcwdUpdateState as CallableFunction)(this.agcwdPtr, this.imagePtr, this.imagePtr);
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
    const imagePtr = (this.wasm.exports.imageNew as CallableFunction)(this.imageDataSize) as number | undefined;
    if (imagePtr === undefined) {
      throw new Error("Failed to create WebAssembly image instance.");
    }
    this.imagePtr = imagePtr;
    this.imageDataPtr = (this.wasm.exports.imageGetDataOffset as CallableFunction)(imagePtr) as number;
  }
}

class LightAdjustmentProcessor {
  private trackProcessor: VideoTrackProcessor;
  private agcwd?: Agcwd;

  constructor() {
    this.trackProcessor = new VideoTrackProcessor();
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
        this.agcwd.processImage(image);
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
}

export { LightAdjustmentProcessor, LightAdjustmentProcessorOptions };
