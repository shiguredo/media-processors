import {
  SelfieSegmentation,
  SelfieSegmentationConfig,
  Results as SelfieSegmentationResults,
} from "@mediapipe/selfie_segmentation";

/**
 * {@link VirtualBackgroundProcessor.startProcessing} メソッドに指定可能なオプション
 */
interface VirtualBackgroundProcessorOptions {
  /**
   * 仮想背景に使用する画像
   *
   * 省略された場合には、元々の背景が使用されます
   */
  backgroundImage?: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement | ImageBitmap | OffscreenCanvas;

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

  /**
   * 背景画像のどの領域を使用するかを決定する関数
   *
   * 背景画像と処理対象映像のアスペクト比が異なる場合の扱いを決定するために使用されます
   *
   * デフォルトでは、背景画像のアスペクト比を維持したまま中央部分を切り抜く {@link cropBackgroundImageCenter} が使われます
   */
  backgroundImageRegion?: (videoFrame: ImageSize, backgroundImage: ImageSize) => ImageRegion;
}

/**
 * 画像の幅と高さ
 */
interface ImageSize {
  width: number;
  height: number;
}

/**
 * 画像の領域（始点とサイズ）
 */
interface ImageRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * 背景画像と処理対象映像のアスペクトが異なる場合に、背景画像の中央部分を切り抜いた領域を返します
 *
 * これは {@link VirtualBackgroundProcessorOptions.backgroundImageRegion} オプションのデフォルトの挙動です
 */
function cropBackgroundImageCenter(videoFrame: ImageSize, backgroundImage: ImageSize): ImageRegion {
  let x = 0;
  let y = 0;
  let width = backgroundImage.width;
  let height = backgroundImage.height;

  const videoFrameRatio = videoFrame.width / videoFrame.height;
  const backgroundImageRatio = backgroundImage.width / backgroundImage.height;
  if (backgroundImageRatio < videoFrameRatio) {
    const newHeight = videoFrame.height * (backgroundImage.width / videoFrame.width);
    y = Math.round((height - newHeight) / 2);
    height = Math.round(newHeight);
  } else if (backgroundImageRatio > videoFrameRatio) {
    const newWidth = videoFrame.width * (backgroundImage.height / videoFrame.height);
    x = Math.round((width - newWidth) / 2);
    width = Math.round(newWidth);
  }

  return { x, y, width, height };
}

/**
 * 常に背景画像の全領域を返します
 *
 * これは {@link VirtualBackgroundProcessorOptions.backgroundImageRegion} オプションに指定可能な関数で、
 * 背景画像と処理対象映像のアスペクト比が異なる場合には、背景画像が映像に合わせて引き伸ばされます
 */
function fillBackgroundImage(_videoFrame: ImageSize, backgroundImage: ImageSize): ImageRegion {
  return { x: 0, y: 0, width: backgroundImage.width, height: backgroundImage.height };
}

/**
 * 映像トラックに仮想背景処理を適用するためのプロセッサ
 */
class VirtualBackgroundProcessor {
  private segmentation: SelfieSegmentation;
  private trackProcessor?: TrackProcessor;
  private processedTrack?: MediaStreamVideoTrack;
  private originalTrack?: MediaStreamVideoTrack;

  /**
   * {@link VirtualBackgroundProcessor} インスタンスを生成します
   *
   * @param assetsPath wasm 等のファイルの配置先ディレクトリパスないしURL
   */
  constructor(assetsPath: string) {
    // セグメンテーションモデルのロード準備
    const config: SelfieSegmentationConfig = {};
    assetsPath = trimLastSlash(assetsPath);
    config.locateFile = (file: string) => {
      return `${assetsPath}/${file}`;
    };
    this.segmentation = new SelfieSegmentation(config);
  }

  /**
   * 実行環境が必要な機能をサポートしているかどうかを判定します
   *
   * "MediaStreamTrack Insertable Streams"が利用可能である必要があります
   *
   * @returns サポートされているかどうか
   */
  static isSupported(): boolean {
    return !(typeof MediaStreamTrackProcessor === "undefined" || typeof MediaStreamTrackGenerator === "undefined");
  }

  /**
   * 仮想背景処理の適用を開始します
   *
   * @param track 処理適用対象となる映像トラック
   * @param options 各種オプション
   *
   * @returns 処理適用後の映像トラック
   *
   * @throws
   * 既にあるトラックを処理中の場合には、エラーが送出されます
   *
   * 処理中かどうかは {@link VirtualBackgroundProcessor.isProcessing} で判定可能です
   */
  async startProcessing(
    track: MediaStreamVideoTrack,
    options: VirtualBackgroundProcessorOptions = {}
  ): Promise<MediaStreamVideoTrack> {
    if (this.isProcessing()) {
      throw Error("Virtual background processing has already started.");
    }

    this.trackProcessor = new TrackProcessor(track, this.segmentation, options);
    this.originalTrack = track;
    this.processedTrack = await this.trackProcessor.startProcessing();
    return this.processedTrack;
  }

  /**
   * 仮想背景処理の適用を停止します
   *
   * コンストラクタに渡された映像トラックは閉じないので、
   * 必要であれば、別途呼び出し側で対処する必要があります
   */
  stopProcessing() {
    // NOTE: コンパイラの警告を防ぐために isProcessing は使わずに判定している
    if (this.trackProcessor !== undefined) {
      this.trackProcessor.stopProcessing();
      this.trackProcessor = undefined;
      this.originalTrack = undefined;
      this.processedTrack = undefined;
    }
  }

  /**
   * 仮想背景処理が実行中かどうかを判定します
   *
   * @returns 実行中であれば `true` 、そうでなければ `false`
   */
  isProcessing(): boolean {
    return this.trackProcessor !== undefined;
  }

  /**
   * 処理適用前の映像トラックを返します
   *
   * これは {@link VirtualBackgroundProcessor.startProcessing} に渡したトラックと等しいです
   *
   * {@link VirtualBackgroundProcessor.startProcessing} 呼び出し前、あるいは、
   * {@link VirtualBackgroundProcessor.stopProcessing} 呼び出し後には `undefined` が返されます
   *
   * @returns 処理適用中の場合は映像トラック、それ以外なら `undefined`
   */
  getOriginalTrack(): MediaStreamVideoTrack | undefined {
    return this.originalTrack;
  }

  /**
   * 処理適用後の映像トラックを返します
   *
   * これは {@link VirtualBackgroundProcessor.startProcessing} が返したトラックと等しいです
   *
   * {@link VirtualBackgroundProcessor.startProcessing} 呼び出し前、あるいは、
   * {@link VirtualBackgroundProcessor.stopProcessing} 呼び出し後には `undefined` が返されます
   *
   * @returns 処理適用中の場合は映像トラック、それ以外なら `undefined`
   */
  getProcessedTrack(): MediaStreamVideoTrack | undefined {
    return this.processedTrack;
  }
}

class TrackProcessor {
  private options: VirtualBackgroundProcessorOptions;
  private track: MediaStreamVideoTrack;
  private canvas: OffscreenCanvas;
  private canvasCtx: OffscreenCanvasRenderingContext2D;
  private segmentation: SelfieSegmentation;
  private abortController: AbortController;
  private generator: MediaStreamVideoTrackGenerator;
  private processor: MediaStreamTrackProcessor<VideoFrame>;

  constructor(
    track: MediaStreamVideoTrack,
    segmentation: SelfieSegmentation,
    options: VirtualBackgroundProcessorOptions
  ) {
    this.options = options;
    this.track = track;

    // 仮想背景描画用の中間バッファ（canvas）の初期化
    const width = track.getSettings().width;
    const height = track.getSettings().height;
    if (width === undefined || height === undefined) {
      throw Error(`Could not retrieve the resolution of the video track: {track}`);
    }
    this.canvas = new OffscreenCanvas(width, height);
    const canvasCtx = this.canvas.getContext("2d", { desynchronized: true });
    if (!canvasCtx) {
      throw Error("Failed to get the 2D context of an OffscreenCanvas");
    }
    this.canvasCtx = canvasCtx;

    // セグメンテーションモデルの設定更新
    let modelSelection = 1; // `1` means "selfie-landscape".
    if (options.segmentationModel && options.segmentationModel === "selfie-general") {
      modelSelection = 0;
    }
    segmentation.setOptions({
      modelSelection,
    });
    segmentation.onResults((results) => {
      this.updateOffscreenCanvas(results);
    });
    this.segmentation = segmentation;

    // 処理を停止するための AbortController を初期化
    this.abortController = new AbortController();

    // generator / processor インスタンスを生成（まだ処理は開始しない）
    this.generator = new MediaStreamTrackGenerator({ kind: "video" });
    this.processor = new MediaStreamTrackProcessor({ track: this.track });
  }

  async startProcessing(): Promise<MediaStreamVideoTrack> {
    await this.segmentation.initialize();

    const signal = this.abortController.signal;
    this.processor.readable
      .pipeThrough(
        new TransformStream({
          transform: async (frame, controller) => {
            // eslint-disable-next-line  @typescript-eslint/no-unsafe-argument
            await this.transform(frame, controller);
          },
        }),
        { signal }
      )
      .pipeTo(this.generator.writable)
      .catch((e) => {
        if (signal.aborted) {
          console.debug("Shutting down streams after abort.");
        } else {
          console.warn("Error from stream transform:", e);
        }
        this.processor.readable.cancel(e).catch((e) => {
          console.warn("Failed to cancel `MediaStreamTrackProcessor`:", e);
        });
        this.generator.writable.abort(e).catch((e) => {
          console.warn("Failed to abort `MediaStreamTrackGenerator`:", e);
        });
      });
    return this.generator;
  }

  stopProcessing() {
    this.abortController.abort();
    this.segmentation.onResults(() => {});
  }

  private async transform(frame: VideoFrame, controller: TransformStreamDefaultController<VideoFrame>): Promise<void> {
    const timestamp = frame.timestamp;
    const duration = frame.duration;
    const image = await createImageBitmap(frame);
    frame.close();

    // @ts-ignore TS2322: 「`image`の型が合っていない」と怒られるけれど、動作はするので一旦無視
    await this.segmentation.send({ image });
    image.close();

    // NOTE: この時点で`this.canvas`は`frame`を反映した内容に更新されている

    if (this.generator.readyState === "ended") {
      // ジェネレータ（ユーザに渡している処理結果トラック）がクローズ済み。
      // この状態で `controller.enqueue()` を呼び出すとエラーが発生するのでスキップする。
      // また `stopProcessing()` を呼び出して変換処理を停止し、以後は `transform()` 自体が呼ばれないようにする。
      //
      // なお、上の条件判定と下のエンキューの間でジェネレータの状態が変わり、エラーが発生する可能性もないとは
      // 言い切れないが、かなりレアケースだと想定され、そこまでケアするのはコスパが悪いので諦めることとする。
      this.stopProcessing();
      return;
    }

    // `VideoFrame` の第一引数に `this.canvas` を直接渡したり、
    // `this.canvas.transferToImageBitmap()` を使って `ImageBitmap` を取得することも可能だが、
    // この方法だと環境によっては、透過時の背景色やぼかしの境界部分処理が変になる現象が確認できているため、
    // ワークアラウンドとして、一度 `ImageData` を経由する方法を採用している
    //
    // `ImageData` を経由しない場合の問題としては https://bugs.chromium.org/p/chromium/issues/detail?id=961777 で
    // 報告されているものが近そう
    const imageData = this.canvasCtx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    const imageBitmap = await createImageBitmap(imageData);
    controller.enqueue(new VideoFrame(imageBitmap, { timestamp, duration } as VideoFrameInit));
  }

  private updateOffscreenCanvas(segmentationResults: SelfieSegmentationResults) {
    this.canvasCtx.save();
    this.canvasCtx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.canvasCtx.drawImage(segmentationResults.segmentationMask, 0, 0, this.canvas.width, this.canvas.height);

    this.canvasCtx.globalCompositeOperation = "source-in";
    this.canvasCtx.drawImage(segmentationResults.image, 0, 0, this.canvas.width, this.canvas.height);

    if (this.options.blurRadius !== undefined) {
      this.canvasCtx.filter = `blur(${this.options.blurRadius}px)`;
    }

    // NOTE: mediapipeの例 (https://google.github.io/mediapipe/solutions/selfie_segmentation.html) では、
    //       "destination-atop"が使われているけれど、背景画像にアルファチャンネルが含まれている場合には、
    //       "destination-atop"だと透過部分と人物が重なる領域が除去されてしまうので、
    //       "destination-over"にしている。
    this.canvasCtx.globalCompositeOperation = "destination-over";
    if (this.options.backgroundImage !== undefined) {
      const decideRegion = this.options.backgroundImageRegion || cropBackgroundImageCenter;
      const region = decideRegion(this.canvas, this.options.backgroundImage);
      this.canvasCtx.drawImage(
        this.options.backgroundImage,
        region.x,
        region.y,
        region.width,
        region.height,
        0,
        0,
        this.canvas.width,
        this.canvas.height
      );
    } else {
      this.canvasCtx.drawImage(segmentationResults.image, 0, 0);
    }

    this.canvasCtx.restore();
  }
}

function trimLastSlash(s: string): string {
  if (s.slice(-1) === "/") {
    return s.slice(0, -1);
  }
  return s;
}

export {
  VirtualBackgroundProcessorOptions,
  VirtualBackgroundProcessor,
  ImageRegion,
  ImageSize,
  cropBackgroundImageCenter,
  fillBackgroundImage,
};
