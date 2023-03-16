// TODO: ImageData にする必要がある（ブラウザのバグ対策）
type ProcessImageBitmapCallback = (frame: ImageBitmap) => Promise<ImageBitmap>;

// TODO: Name
class VideoTrackProcessor {
  private trackProcessor?: TrackProcessor;
  private processedTrack?: MediaStreamVideoTrack;
  private originalTrack?: MediaStreamVideoTrack;

  static isSupported(): boolean {
    return TrackProcessorWithBreakoutBox.isSupported() || TrackProcessorWithRequestVideoFrameCallback.isSupported();
  }

  async startProcessing(
    track: MediaStreamVideoTrack,
    callback: ProcessImageBitmapCallback
  ): Promise<MediaStreamVideoTrack> {
    if (this.isProcessing()) {
      throw Error("Video track processing has already started.");
    }

    if (TrackProcessorWithBreakoutBox.isSupported()) {
      this.trackProcessor = new TrackProcessorWithBreakoutBox(track, callback);
    } else if (TrackProcessorWithRequestVideoFrameCallback.isSupported()) {
      this.trackProcessor = new TrackProcessorWithRequestVideoFrameCallback(track, callback);
    } else {
      throw Error("Unsupported browser");
    }
    this.originalTrack = track;
    this.processedTrack = await this.trackProcessor.startProcessing();
    return this.processedTrack;
  }

  stopProcessing() {
    // NOTE: コンパイラの警告を防ぐために isProcessing は使わずに判定している
    if (this.trackProcessor !== undefined) {
      this.trackProcessor.stopProcessing();
      this.trackProcessor = undefined;
      this.originalTrack = undefined;
      this.processedTrack = undefined;
    }
  }

  isProcessing(): boolean {
    return this.trackProcessor !== undefined;
  }

  getOriginalTrack(): MediaStreamVideoTrack | undefined {
    return this.originalTrack;
  }

  getProcessedTrack(): MediaStreamVideoTrack | undefined {
    return this.processedTrack;
  }
}

// TODO: name
abstract class TrackProcessor {
  protected track: MediaStreamVideoTrack;
  protected callback: ProcessImageBitmapCallback;

  constructor(track: MediaStreamVideoTrack, callback: ProcessImageBitmapCallback) {
    this.track = track;
    this.callback = callback;
  }

  abstract startProcessing(): Promise<MediaStreamVideoTrack>;

  abstract stopProcessing(): void;
}

class TrackProcessorWithBreakoutBox extends TrackProcessor {
  private abortController: AbortController;
  private generator: MediaStreamVideoTrackGenerator;
  private processor: MediaStreamTrackProcessor<VideoFrame>;

  constructor(track: MediaStreamVideoTrack, callback: ProcessImageBitmapCallback) {
    super(track, callback);

    // 処理を停止するための AbortController を初期化
    this.abortController = new AbortController();

    // generator / processor インスタンスを生成（まだ処理は開始しない）
    this.generator = new MediaStreamTrackGenerator({ kind: "video" });
    this.processor = new MediaStreamTrackProcessor({ track: this.track });
  }

  static isSupported(): boolean {
    return !(typeof MediaStreamTrackProcessor === "undefined" || typeof MediaStreamTrackGenerator === "undefined");
  }

  startProcessing(): Promise<MediaStreamVideoTrack> {
    const signal = this.abortController.signal;
    this.processor.readable
      .pipeThrough(
        new TransformStream({
          transform: async (frame, controller) => {
            const timestamp = frame.timestamp;
            const duration = frame.duration;
            const image = await createImageBitmap(frame);

            // eslint-disable-next-line  @typescript-eslint/no-unsafe-argument
            const processedImage = await this.callback(image);
            frame.close();

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

            // `VideoFrame` の第一引数に ImageBitmap を直接渡すことは可能だが、
            // この方法だと環境によっては、透過時の背景色やぼかしの境界部分処理が変になる現象が確認できているため、
            // ワークアラウンドとして、一度 `ImageData` を経由する方法を採用している
            //
            // `ImageData` を経由しない場合の問題としては https://bugs.chromium.org/p/chromium/issues/detail?id=961777 で
            // 報告されているものが近そう

            // TODO
            // const imageData = this.canvasCtx.getImageData(0, 0, this.canvas.width, this.canvas.height);
            // const imageBitmap = await createImageBitmap(imageData);
            // controller.enqueue(new VideoFrame(imageBitmap, { timestamp, duration } as VideoFrameInit));

            const processedFrame = new VideoFrame(processedImage, { timestamp, duration } as VideoFrameInit);
            controller.enqueue(processedFrame);
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
    return Promise.resolve(this.generator);
  }

  stopProcessing() {
    this.abortController.abort();
  }
}

class TrackProcessorWithRequestVideoFrameCallback extends TrackProcessor {
  private video: HTMLVideoElement;
  private canvas: HTMLCanvasElement;
  private canvasCtx: CanvasRenderingContext2D;
  private requestVideoFrameCallbackHandle?: number;

  constructor(track: MediaStreamVideoTrack, callback: ProcessImageBitmapCallback) {
    super(track, callback);

    // requestVideoFrameCallbackHandle()` はトラックではなくビデオ単位のメソッドなので
    // 内部的に HTMLVideoElement を生成する
    this.video = document.createElement("video");
    this.video.muted = true;
    this.video.playsInline = true;
    this.video.srcObject = new MediaStream([track]);

    // 処理後の映像フレームを書き込むための canvas を生成する
    //
    // captureStream() メソッドは OffscreenCanvas にはないようなので HTMLCanvasElement を使用する
    const width = track.getSettings().width;
    const height = track.getSettings().height;
    if (width === undefined || height === undefined) {
      throw Error(`Could not retrieve the resolution of the video track: {track}`);
    }
    this.canvas = document.createElement("canvas");
    this.canvas.width = width;
    this.canvas.height = height;
    const canvasCtx = this.canvas.getContext("2d");
    if (!canvasCtx) {
      throw Error("Failed to create 2D canvas context");
    }
    this.canvasCtx = canvasCtx;
  }

  static isSupported(): boolean {
    return "requestVideoFrameCallback" in HTMLVideoElement.prototype;
  }

  async startProcessing(): Promise<MediaStreamVideoTrack> {
    this.requestVideoFrameCallbackHandle = this.video.requestVideoFrameCallback(() => {
      this.onFrame().catch((e) => console.warn("Error: ", e));
    });
    await this.video.play();

    const stream = this.canvas.captureStream();
    return Promise.resolve(stream.getVideoTracks()[0]);
  }

  stopProcessing() {
    if (this.requestVideoFrameCallbackHandle !== undefined) {
      this.video.pause();
      this.video.cancelVideoFrameCallback(this.requestVideoFrameCallbackHandle);
      this.requestVideoFrameCallbackHandle = undefined;
    }
  }

  private async onFrame() {
    // TODO: resize check

    const image = await createImageBitmap(this.video);
    const processedImage = await this.callback(image);
    this.canvasCtx.drawImage(processedImage, 0, 0);

    // @ts-ignore
    // eslint-disable-next-line
    this.requestVideoFrameCallbackHandle = this.video.requestVideoFrameCallback(() => {
      this.onFrame().catch((e) => console.warn("Error: ", e));
    });
  }
}

export { VideoTrackProcessor, ProcessImageBitmapCallback };
