import {
  SelfieSegmentation,
  SelfieSegmentationConfig,
  Results as SelfieSegmentationResults,
} from "@mediapipe/selfie_segmentation";

/**
 * {@link VirtualBackgroundProcessor} に指定可能なオプション
 */
interface VirtualBackgroundProcessorOptions {
  /**
   * wasm 等のファイルの配置先ディレクトリパスないしURL
   *
   * デフォルトでは、カレントディレクトリが使用されます
   */
  assetsPath?: string;

  /**
   * 仮想背景に使用する画像
   *
   * 省略された場合には、元々の背景が使用されます
   */
  backgroundImage?: CanvasImageSourceWebCodecs;

  /**
   * 背景ぼかし効果の半径（pixel）
   *
   * 値が大きいほど、ぼかしが強くなります。
   * デフォルトではぼかしは無効で、これは値として0を指定した場合の挙動と等しいです。
   */
  blurRadius?: number;

  /**
   * セグメンテーションに使用するモデル
   *
   * デフォルトでは"selfie-landscape"が使用されます。
   * それぞれのモデルの詳細については
   * [MediaPipe Selfie Segmentation](https://google.github.io/mediapipe/solutions/selfie_segmentation.html)
   * を参照してください。
   */
  segmentationModel?: "selfie-landscape" | "selfie-general";
}

/**
 * 映像トラックに仮想背景処理を適用するためのプロセッサ
 */
class VirtualBackgroundProcessor {
  private options: VirtualBackgroundProcessorOptions;
  private track: MediaStreamVideoTrack;
  private segmentation: SelfieSegmentation;
  private originalVideo: HTMLVideoElement;
  private workingCanvas: HTMLCanvasElement;
  private workingCanvasCtx: CanvasRenderingContext2D;
  private processedCanvas: HTMLCanvasElement;
  private processedCanvasCtx: CanvasRenderingContext2D;
  private requestVideoFrameCallbackHandle?: number;

  /**
   * {@link VirtualBackgroundProcessor} インスタンスを生成します
   *
   * {@link VirtualBackgroundProcessor.startProcessing} メソッドが呼び出されるまでは、
   * 処理は開始されません
   *
   * @param track 処理適用対象となる映像トラック
   * @param options 各種オプション
   */
  constructor(track: MediaStreamVideoTrack, options: VirtualBackgroundProcessorOptions = {}) {
    this.options = options;
    this.track = track;

    // 仮想背景描画用の中間バッファ（canvas）の初期化
    const width = track.getSettings().width;
    const height = track.getSettings().height;
    if (width === undefined || height === undefined) {
      throw Error(`Could not retrieve the resolution of the video track: {track}`);
    }

    this.originalVideo = document.createElement("video");
    this.originalVideo.srcObject = new MediaStream([track]);

    this.workingCanvas = document.createElement("canvas");
    this.workingCanvas.width = width;
    this.workingCanvas.height = height;
    const workingCanvasCtx = this.workingCanvas.getContext("2d");
    if (!workingCanvasCtx) {
      throw Error("Failed to create 2D canvas context");
    }
    this.workingCanvasCtx = workingCanvasCtx;

    this.processedCanvas = document.createElement("canvas");
    this.processedCanvas.width = width;
    this.processedCanvas.height = height;
    const processedCanvasCtx = this.processedCanvas.getContext("2d");
    if (!processedCanvasCtx) {
      throw Error("Failed to create 2D canvas context");
    }
    this.processedCanvasCtx = processedCanvasCtx;

    // セグメンテーションモデルの初期化
    const config: SelfieSegmentationConfig = {};
    const assetsPath = options.assetsPath || ".";
    config.locateFile = (file: string) => {
      return `${assetsPath}/${file}`;
    };
    this.segmentation = new SelfieSegmentation(config);
    let modelSelection = 1; // `1` means "selfie-landscape".
    if (options.segmentationModel && options.segmentationModel === "selfie-general") {
      modelSelection = 0;
    }
    this.segmentation.setOptions({
      modelSelection,
    });
    this.segmentation.onResults((results) => {
      this.updateWorkingCanvas(results);
    });
  }

  private async onFrame() {
    this.workingCanvasCtx.clearRect(0, 0, this.workingCanvas.width, this.workingCanvas.height);
    this.workingCanvasCtx.drawImage(this.originalVideo, 0, 0, this.workingCanvas.width, this.workingCanvas.height);
    let imageData = this.workingCanvasCtx.getImageData(0, 0, this.workingCanvas.width, this.workingCanvas.height);

    // @ts-ignore
    await this.segmentation.send({ image: imageData });

    imageData = this.workingCanvasCtx.getImageData(0, 0, this.workingCanvas.width, this.workingCanvas.height);

    this.processedCanvasCtx.putImageData(imageData, 0, 0);

    // @ts-ignore
    // eslint-disable-next-line
    this.requestVideoFrameCallbackHandle = this.originalVideo.requestVideoFrameCallback(() => {
      this.onFrame().catch((e) => console.warn("Error: ", e));
    });
  }

  /**
   * 実行環境が必要な機能をサポートしているかどうかを判定します
   *
   * "MediaStreamTrack Insertable Streams"が利用可能である必要があります
   *
   * @returns サポートされているかどうか
   */
  static isSupported(): boolean {
    // TODO: requestVideoFrameCallbackの有無を判定する
    return true;
  }

  /**
   * 仮想背景処理の適用を開始します
   *
   * @returns 処理適用後の映像トラック
   */
  async startProcessing(): Promise<MediaStreamTrack> {
    if (this.requestVideoFrameCallbackHandle !== undefined) {
      throw Error("already started");
    }

    // @ts-ignore
    // eslint-disable-next-line
    this.requestVideoFrameCallbackHandle = this.originalVideo.requestVideoFrameCallback(() => {
      this.onFrame().catch((e) => console.warn("Error: ", e));
    });
    await this.originalVideo.play();

    const stream = this.processedCanvas.captureStream();
    return Promise.resolve(stream.getVideoTracks()[0]);
  }

  /**
   * 仮想背景処理の適用を停止します
   *
   * コンストラクタに渡された映像トラックは閉じないので、
   * 必要であれば、別途呼び出し側で対処する必要があります
   */
  stopProcessing() {
    if (this.requestVideoFrameCallbackHandle !== undefined) {
      this.originalVideo.pause();
      // @ts-ignore
      // eslint-disable-next-line
      this.originalVideo.cancelVideoFrameCallback(this.requestVideoFrameCallbackHandle);
      this.requestVideoFrameCallbackHandle = undefined;
    }
  }

  private updateWorkingCanvas(segmentationResults: SelfieSegmentationResults) {
    this.workingCanvasCtx.save();
    this.workingCanvasCtx.clearRect(0, 0, this.workingCanvas.width, this.workingCanvas.height);
    this.workingCanvasCtx.drawImage(
      segmentationResults.segmentationMask,
      0,
      0,
      this.workingCanvas.width,
      this.workingCanvas.height
    );

    this.workingCanvasCtx.globalCompositeOperation = "source-in";
    this.workingCanvasCtx.drawImage(
      segmentationResults.image,
      0,
      0,
      this.workingCanvas.width,
      this.workingCanvas.height
    );

    if (this.options.blurRadius !== undefined) {
      this.workingCanvasCtx.filter = `blur(${this.options.blurRadius}px)`;
    }

    // NOTE: mediapipeの例 (https://google.github.io/mediapipe/solutions/selfie_segmentation.html) では、
    //       "destination-atop"が使われているけれど、背景画像にアルファチャンネルが含まれている場合には、
    //       "destination-atop"だと透過部分と人物が重なる領域が除去されてしまうので、
    //       "destination-over"にしている。
    this.workingCanvasCtx.globalCompositeOperation = "destination-over";
    if (this.options.backgroundImage !== undefined) {
      this.workingCanvasCtx.drawImage(
        this.options.backgroundImage,
        0,
        0,
        this.workingCanvas.width,
        this.workingCanvas.height
      );
    } else {
      this.workingCanvasCtx.drawImage(segmentationResults.image, 0, 0);
    }

    this.workingCanvasCtx.restore();
  }
}

export { VirtualBackgroundProcessorOptions, VirtualBackgroundProcessor };
