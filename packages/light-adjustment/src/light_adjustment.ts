import { VideoTrackProcessor } from "@shiguredo/video-track-processor";
import {
  SelfieSegmentation,
  SelfieSegmentationConfig,
  Results as SelfieSegmentationResults,
} from "@mediapipe/selfie_segmentation";

const LIGHT_ADJUSTMENT_WASM = "__LIGHT_ADJUSTMENT_WASM__";

/**
 * {@link LightAdjustmentProcessor} に指定可能なオプション
 */
interface LightAdjustmentProcessorOptions {
  /**
   * AGCWD の論文 (Efficient Contrast Enhancement Using Adaptive Gamma Correction With Weighting Distribution) に
   * 登場する調整パラメータ（非負の数値）。
   * この値が大きいほど画像のコントラストが強調される傾向がある。
   *
   * デフォルト値は 0.5
   */
  alpha?: number;

  /**
   * ライト調整処理の度合い。
   *
   * AGCWD によるライト調整処理適用前後の画像の混合割合（パーセンテージ）で、
   * 0 なら処理適用前の画像が、100 なら処理適用後の画像が、50 ならそれらの半々が、採用されることになる。
   *
   * デフォルト値は 50
   */
  adjustmentLevel?: number;

  /**
   * AGCWD によるライト調整後に画像に適用するシャープネス処理の度合い。
   *
   * シャープネス処理適用前後の画像の混合割合（パーセンテージ）で、
   * 0 なら処理適用前の画像が、100 なら処理適用後の画像が、50 ならそれらの半々が、採用されることになる。
   *
   * 0 を指定した場合にはシャープネス処理が完全にスキップされて、処理全体がより高速になる。
   *
   * デフォルト値は 20
   */
  sharpnessLevel?: number;

  /**
   * 処理後の画像の最低の明るさ (HSV の V の値、 0 ~ 255 の整数）。
   *
   * デフォルト値は 10
   */
  minIntensity?: number;

  /**
   * 処理後の画像の最大の明るさ (HSV の V の値、 0 ~ 255 の整数）。
   *
   * デフォルト値は 255
   */
  maxIntensity?: number;

  /**
   * AGCWD の論文に登場する、映像のフレーム間の差異を検知する際の閾値（0.0 ~ 1.0 の数値）
   *
   * 新しい映像フレームが以前のものと差異があると判定された場合には、
   * ライト調整用の変換テーブルが更新されることになる。
   *
   * 値が小さくなるほど、微細な変化でテーブルが更新されるようになるため、
   * より適切な調整が行われやすくなるが、その分処理負荷は高くなる。
   *
   * 0 を指定した場合には毎フレームで更新が行われるようになる。
   *
   * デフォルト値は 0.05
   */
  entropyThreshold?: number;

  /**
   * ライト調整の際に基準とする画像領域を指定するマスクの取得方法。
   *
   * デフォルトでは {@link UniformFocusMask} が使用される。
   *
   * {@link UniformFocusMask} は画像全体を均一に扱って調整を行うため、
   * 例えば逆光時には人物が暗いままになってしまうことがある。
   * その際には {@link SelfieSegmentationFocusMask} を使用すれば、
   * 人物部分のみがマスクとして取得され、そこの明るさが適切になるような調整が行われるようになる。
   *
   * なおマスクの値は「画像のライトをどのように調整するか（より具体的には明るさ変換テーブルをどう構築するか）」を
   * 左右するだけで、調整処理自体は常に画像全体に対して行われる。
   *
   * マスク取得は毎フレームではなく、最後にマスクを取得したフレームに対して、
   * {@link LightAdjustmentProcessorOptions.entropyThreshold} の閾値を超える変化が検知された時にのみ行われる。
   */
  focusMask?: FocusMask;
}

class LightAdjustmentProcessorStats {
  totalProcessedFrames = 0;
  totalProcessedTimeMs = 0;
  totalUpdateStateCount = 0;

  getAverageProcessedTimeMs(): number {
    if (this.totalProcessedFrames === 0) {
      return 0;
    } else {
      return this.totalProcessedTimeMs / this.totalProcessedFrames;
    }
  }

  reset(): void {
    this.totalProcessedFrames = 0;
    this.totalProcessedTimeMs = 0;
    this.totalUpdateStateCount = 0;
  }
}

class LightAdjustmentProcessor {
  private trackProcessor: VideoTrackProcessor;
  private stats: LightAdjustmentProcessorStats;
  private wasm?: WasmLightAdjustment;
  private focusMask: FocusMask;
  private isOptionsUpdated = false;

  constructor() {
    this.trackProcessor = new VideoTrackProcessor();
    this.stats = new LightAdjustmentProcessorStats();
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

    const start = performance.now();

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

    const elapsed = performance.now() - start;
    this.stats.totalProcessedTimeMs += elapsed;
    this.stats.totalProcessedFrames += 1;
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

  getStats(): LightAdjustmentProcessorStats {
    return this.stats;
  }

  resetStats(): void {
    this.stats.reset();
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
      if (options.alpha < 0 || !isFinite(options.alpha)) {
        throw new Error(`Invaild alpha value: ${options.alpha} (must be a non-negative number)`);
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
      this.processSegmentationResults(results);
    });
  }

  async getFocusMask(image: ImageData): Promise<Uint8Array> {
    // @ts-ignore TS2322: 「`image`の型が合っていない」と怒られるけれど、動作はするので一旦無視
    await this.segmentation.send({ image });
    return this.mask;
  }

  private processSegmentationResults(results: SelfieSegmentationResults): void {
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
  LightAdjustmentProcessorStats,
  LightAdjustmentProcessorOptions,
  FocusMask,
  UniformFocusMask,
  CenterFocusMask,
  SelfieSegmentationFocusMask,
};
