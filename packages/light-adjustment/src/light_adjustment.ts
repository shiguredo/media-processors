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
   * デフォルト値は 0
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

/**
 * 映像トラックにライト（明るさ）調整処理を適用するためのプロセッサ
 *
 * 調整処理は AGCWD (Efficient Contrast Enhancement Using Adaptive Gamma Correction With Weighting Distribution) という
 * アルゴリズムをベースにしています
 */
class LightAdjustmentProcessor {
  private trackProcessor: VideoTrackProcessor;
  private stats: LightAdjustmentProcessorStats;
  private wasm?: WasmLightAdjustment;
  private focusMask: FocusMask;
  private isOptionsUpdated = false;

  /**
   * {@link LightAdjustmentProcessor} インスタンスを生成します
   */
  constructor() {
    this.trackProcessor = new VideoTrackProcessor();
    this.stats = new LightAdjustmentProcessorStats();
    this.focusMask = new UniformFocusMask();
  }

  /**
   * 実行環境が必要な機能をサポートしているかどうかを判定します
   *
   * 以下のいずれかが利用可能である必要があります:
   * - MediaStreamTrack Insertable Streams (aka. Breakout Box)
   * - HTMLVideoElement.requestVideoFrameCallback
   *
   * @returns サポートされているかどうか
   */
  static isSupported(): boolean {
    return VideoTrackProcessor.isSupported();
  }

  /**
   * ライト調整処理の適用を開始します
   *
   * @param track 処理適用対象となる映像トラック
   * @param options 各種オプション
   *
   * @returns 処理適用後の映像トラック
   *
   * @throws
   * 既にあるトラックを処理中の場合には、エラーが送出されます
   *
   * 処理中かどうかは {@link LightAdjustmentProcessor.isProcessing} で判定可能です
   */
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
    this.updateOptions(options);

    this.resetStats();
    return this.trackProcessor.startProcessing({
      track,
      imageDataCallback: async (image: ImageData) => {
        await this.processImage(image);
        return image;
      },
      canvasCallback: undefined,
    });
  }

  private async processImage(image: ImageData): Promise<void> {
    if (this.wasm === undefined) {
      return;
    }

    const start = performance.now();

    this.wasm.setImageData(image);
    if (this.isOptionsUpdated || this.wasm.isStateObsolete()) {
      // TODO(sile): SelfieSegmentationFocusMask の場合には、一番最初にファイルのダウンロードや初期化処理が入るので、
      //             ここに await を入れると少し映像が止まることがある。
      //             マスク更新は必須の処理という訳ではないので `await` ではなく `.then()` で繋いだ方が
      //             ユーザの体験としては良くなるかもしれない。
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

  /**
   * ライト調整処理の適用を停止します
   *
   * コンストラクタに渡された映像トラックは閉じないので、
   * 必要であれば、別途呼び出し側で対処する必要があります
   */
  stopProcessing() {
    this.trackProcessor.stopProcessing();
    if (this.wasm !== undefined) {
      this.wasm.destroy();
      this.wasm = undefined;
    }
  }

  /**
   * ライト調整処理が実行中かどうかを判定します
   *
   * @returns 実行中であれば `true` 、そうでなければ `false`
   */
  isProcessing(): boolean {
    return this.trackProcessor.isProcessing();
  }

  /**
   * 処理適用前の映像トラックを返します
   *
   * これは {@link LightAdjustmentProcessor.startProcessing} に渡したトラックと等しいです
   *
   * {@link LightAdjustmentProcessor.startProcessing} 呼び出し前、あるいは、
   * {@link LightAdjustmentProcessor.stopProcessing} 呼び出し後には `undefined` が返されます
   *
   * @returns 処理適用中の場合は映像トラック、それ以外なら `undefined`
   */
  getOriginalTrack(): MediaStreamVideoTrack | undefined {
    return this.trackProcessor.getOriginalTrack();
  }

  /**
   * 処理適用後の映像トラックを返します
   *
   * これは {@link LightAdjustmentProcessor.startProcessing} が返したトラックと等しいです
   *
   * {@link LightAdjustmentProcessor.startProcessing} 呼び出し前、あるいは、
   * {@link LightAdjustmentProcessor.stopProcessing} 呼び出し後には `undefined` が返されます
   *
   * @returns 処理適用中の場合は映像トラック、それ以外なら `undefined`
   */
  getProcessedTrack(): MediaStreamVideoTrack | undefined {
    return this.trackProcessor.getProcessedTrack();
  }

  /**
   * 適用中の処理のオプションを更新します
   *
   * 処理が適用中ではない場合には、このメソッド呼び出しは単に無視されます
   *
   * @param options 更新対象のオプション。省略された項目については現在の値がそのまま使用されます。
   */
  updateOptions(options: LightAdjustmentProcessorOptions): void {
    if (this.wasm !== undefined) {
      this.wasm.updateOptions(options);
      if (options.focusMask !== undefined) {
        this.focusMask = options.focusMask;
      }
      this.isOptionsUpdated = true;
    }
  }

  /**
   * 適用中の処理の現在の統計値を取得します
   *
   * @returns 統計値オブジェクト
   */
  getStats(): LightAdjustmentProcessorStats {
    return this.stats;
  }

  /**
   * 統計値を初期化します
   */
  resetStats(): void {
    this.stats.reset();
  }
}

/**
 * ライト調整処理の各種統計値
 */
class LightAdjustmentProcessorStats {
  /**
   * 処理した映像フレームの合計数
   */
  totalProcessedFrames = 0;

  /**
   * 映像フレームの処理に要した合計時間（ミリ秒単位）
   */
  totalProcessedTimeMs = 0;

  /**
   * ライト調整用の変換テーブルを更新した数
   */
  totalUpdateStateCount = 0;

  /**
   * 映像フレームの処理に要した時間の平均値を取得します
   *
   * @returns ミリ秒単位の平均所要時間
   */
  getAverageProcessedTimeMs(): number {
    if (this.totalProcessedFrames === 0) {
      return 0;
    } else {
      return this.totalProcessedTimeMs / this.totalProcessedFrames;
    }
  }

  /**
   * 統計値を初期化します
   */
  reset(): void {
    this.totalProcessedFrames = 0;
    this.totalProcessedTimeMs = 0;
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

    const width = track.getSettings().width || 0;
    const height = track.getSettings().height || 0;
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

  updateOptions(options: LightAdjustmentProcessorOptions): void {
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

    const succeeded = (this.wasm.exports.resize as CallableFunction)(
      this.lightAdjustmentPtr,
      image.width,
      image.height
    ) as boolean;
    if (!succeeded) {
      throw new Error("Failed to resize WebAssembly image data.");
    }

    this.imageDataPtr = (this.wasm.exports.getImageData as CallableFunction)(this.lightAdjustmentPtr) as number;
    this.maskDataPtr = (this.wasm.exports.getFocusMaskData as CallableFunction)(this.lightAdjustmentPtr) as number;
    this.imageWidth = image.width;
    this.imageHeight = image.height;
  }
}

/**
 * ライト調整の際に画像のどの領域を基準にするかを指定するためのインタフェース。
 */
interface FocusMask {
  /**
   * ライト調整の際にフォーカスする領域を示すマスク配列を返す。
   *
   * 返り値の各バイトは画像の一つのピクセルに対応し、値はそのピクセルの重みを表す。
   * 重みが大きいピクセルほど、ライト調整の際により適切な明るさになるように処理される。
   *
   * なお、このメソッドが返すマスク配列はあくまでも「画像（の明るさ）をどのように調整するか」を
   * 左右するだけであり、ライト調整処理自体は常に画像全体に適用される。
   *
   * @param options 処理対象となる入力画像
   * @returns フォーカス領域を示すバイト列
   */
  getFocusMask(image: ImageData): Promise<Uint8Array>;
}

/**
 * 画像全体を均等に扱うフォーカスマスク。
 */
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

/**
 * 画像全体を九分割して、その中央部分にフォーカスするマスク。
 */
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

/**
 * 画像内の人物部分にフォーカスするマスク。
 *
 * 画像から人物領域をセグメンテーションするためには
 * @mediapipe/selfie-segmentation パッケージを使用している。
 */
class SelfieSegmentationFocusMask implements FocusMask {
  private segmentation: SelfieSegmentation;
  private mask: Uint8Array;
  private canvas: OffscreenCanvas;
  private canvasCtx: OffscreenCanvasRenderingContext2D;

  /**
   * {@link SelfieSegmentationFocusMask} インスタンスを生成する。
   *
   * @param assetsPath @mediapipe/selfie-segmentation のアセットファイル（.wasm や .tflite）が配置されているパス
   */
  constructor(assetsPath: string) {
    this.mask = new Uint8Array();
    this.canvas = createOffscreenCanvas(0, 0) as OffscreenCanvas;
    const canvasCtx = this.canvas.getContext("2d", {
      desynchronized: true,
      willReadFrequently: true,
    });
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
