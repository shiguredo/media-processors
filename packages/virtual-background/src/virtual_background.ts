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
  private lastFrame?: VideoFrame;

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
  }

  async startProcessing(): Promise<MediaStreamVideoTrack> {
    await this.segmentation.initialize();

    const signal = this.abortController.signal;

    const generator = new MediaStreamTrackGenerator({ kind: "video" });
    const processor = new MediaStreamTrackProcessor({ track: this.track });
    processor.readable
      .pipeThrough(
        new TransformStream({
          transform: async (frame, controller) => {
            // eslint-disable-next-line  @typescript-eslint/no-unsafe-argument
            await this.transform(frame, controller);
          },
        }),
        { signal }
      )
      .pipeTo(generator.writable)
      .catch((e) => {
        if (signal.aborted) {
          console.debug("Shutting down streams after abort.");
        } else if (generator.readyState === "ended") {
          console.debug("Processed track was closed.");
        } else {
          // 未知のエラーなので、警告ログを出しておく
          console.warn("Error from stream transform:", e);
        }
        if (this.lastFrame !== undefined) {
          // 処理済みトラック（i.e., generator）のクローズタイミング次第では、
          // transfrom メソッド内で controller.enqueue() で追加したフレームが未処理となり、
          // クローズされずに放置されることになる。
          //
          // そのようなケースでは、最終的に以下のようなエラーメッセージが Chrome で表示されるため、
          // その対策として、ここで自前で close() を呼んでいる。
          //
          // > A VideoFrame was garbage collected without being closed.
          // > Applications should call close() on frames when done with them to prevent stalls.
          this.lastFrame.close();
          this.lastFrame = undefined;
        }

        processor.readable.cancel(e).catch((e) => {
          console.warn("Failed to cancel `MediaStreamTrackProcessor`:", e);
        });
        generator.writable.abort(e).catch((e) => {
          console.warn("Failed to abort `MediaStreamTrackGenerator`:", e);
        });
      });

    return generator;
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

    // @ts-ignore TS2345: 「`canvas`の型が合っていない」と怒られるけれど、動作はするので一旦無視。
    this.lastFrame = new VideoFrame(this.canvas, { timestamp, duration });
    controller.enqueue(this.lastFrame);
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
      this.canvasCtx.drawImage(this.options.backgroundImage, 0, 0, this.canvas.width, this.canvas.height);
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

export { VirtualBackgroundProcessorOptions, VirtualBackgroundProcessor };
