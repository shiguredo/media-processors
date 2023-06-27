// [NOTE]
// ImageData ではなく ImageBitmap の方が効率的な可能性はあるが
// https://bugs.chromium.org/p/chromium/issues/detail?id=961777 のように特定条件下で処理後の結果が
// 不正なものになる現象が確認できているので安全のために ImageData にしていたが、
// CanvasからImageDataを作成する処理がGPU-CPU間のコピーになり重いため、Canvas/ImageDataの両対応にする
type ProcessImageDataCallback = (image: ImageData) => Promise<ImageData>;
type ProcessCanvasCallback = (image: ImageBitmap | HTMLVideoElement) => Promise<HTMLCanvasElement | OffscreenCanvas>;

type StartProcessingParams = {
  track: MediaStreamVideoTrack;
  imageDataCallback: ProcessImageDataCallback;
  canvasCallback: undefined;
} | {
  track: MediaStreamVideoTrack;
  imageDataCallback: undefined;
  canvasCallback: ProcessCanvasCallback;
}

/**
 * 映像トラックの各フレームの変換処理を行いやすくするためのユーティリティクラス
 *
 * 以下の二つの仕組みを抽象化して共通のインタフェースを提供する:
 * - MediaStreamTrack Insertable Streams (aka. Breakout Box)
 * - HTMLVideoElement.requestVideoFrameCallback
 *
 * 実際の変換処理は利用側がコールバック関数として指定する
 */
class VideoTrackProcessor {
  private trackProcessor?: Processor;
  private processedTrack?: MediaStreamVideoTrack;
  private originalTrack?: MediaStreamVideoTrack;

  static isSupported(): boolean {
    return BreakoutBoxProcessor.isSupported() || RequestVideoFrameCallbackProcessor.isSupported();
  }

  async startProcessing(
    {track, imageDataCallback, canvasCallback}: StartProcessingParams
  ): Promise<MediaStreamVideoTrack> {
    if (this.isProcessing()) {
      throw Error("Video track processing has already started.");
    }

    if (BreakoutBoxProcessor.isSupported()) {
      this.trackProcessor = new BreakoutBoxProcessor(track, imageDataCallback, canvasCallback);
    } else if (RequestVideoFrameCallbackProcessor.isSupported()) {
      this.trackProcessor = new RequestVideoFrameCallbackProcessor(track, imageDataCallback, canvasCallback);
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

abstract class Processor {
  protected track: MediaStreamVideoTrack;
  protected imageDataCallback?: ProcessImageDataCallback;
  protected canvasCallback?: ProcessCanvasCallback;

  constructor(track: MediaStreamVideoTrack, imageDataCallback?: ProcessImageDataCallback, canvasCallback?: ProcessCanvasCallback) {
    this.track = track;
    this.imageDataCallback = imageDataCallback;
    this.canvasCallback = canvasCallback;
  }

  abstract startProcessing(): Promise<MediaStreamVideoTrack>;

  abstract stopProcessing(): void;
}

class BreakoutBoxProcessor extends Processor {
  private abortController: AbortController;
  private generator: MediaStreamVideoTrackGenerator;
  private processor: MediaStreamTrackProcessor<VideoFrame>;
  private canvas: OffscreenCanvas;
  private canvasCtx: OffscreenCanvasRenderingContext2D;

  constructor(track: MediaStreamVideoTrack, imageDataCallback?: ProcessImageDataCallback, canvasCallback?: ProcessCanvasCallback) {
    super(track, imageDataCallback, canvasCallback);

    // 処理を停止するための AbortController を初期化
    this.abortController = new AbortController();

    // generator / processor インスタンスを生成（まだ処理は開始しない）
    this.generator = new MediaStreamTrackGenerator({ kind: "video" });
    this.processor = new MediaStreamTrackProcessor({ track: this.track });

    // 作業用キャンバスを作成
    const width = track.getSettings().width || 0;
    const height = track.getSettings().height || 0;

    this.canvas = new OffscreenCanvas(width, height);
    const canvasCtx = this.canvas.getContext("2d", { desynchronized: true, willReadFrequently: true });
    if (canvasCtx === null) {
      throw Error("Failed to get the 2D context of an offscreen canvas");
    }
    this.canvasCtx = canvasCtx;
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
            const { displayWidth: width, displayHeight: height, timestamp, duration } = frame;
            if (this.imageDataCallback !== undefined) {
              resizeCanvasIfNeed(width, height, this.canvas);

              this.canvasCtx.drawImage(frame, 0, 0);
              frame.close();
              const image = this.canvasCtx.getImageData(0, 0, width, height);
              const processedImage = await this.imageDataCallback(image);


              const bitmap = await createImageBitmap(processedImage);
              controller.enqueue(new VideoFrame(bitmap, { timestamp, duration } as VideoFrameInit));
            } else if (this.canvasCallback !== undefined) {
              const image = await createImageBitmap(frame);
              frame.close();
              const processedImage = await this.canvasCallback(image);
              image.close();
              controller.enqueue(new VideoFrame(processedImage, {timestamp, duration} as VideoFrameInit));
            } else {
              throw new Error("No callback is set");
            }
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

class RequestVideoFrameCallbackProcessor extends Processor {
  private video: HTMLVideoElement;
  private requestVideoFrameCallbackHandle?: number;

  // 処理結果画像を書き込むキャンバス
  private canvas: HTMLCanvasElement;
  private canvasCtx: CanvasRenderingContext2D;

  // 処理途中の作業用キャンバス
  private tmpCanvas: OffscreenCanvas;
  private tmpCanvasCtx: OffscreenCanvasRenderingContext2D;

  constructor(track: MediaStreamVideoTrack, imageDataCallback?: ProcessImageDataCallback, canvasCallback?: ProcessCanvasCallback) {
    super(track, imageDataCallback, canvasCallback);

    // requestVideoFrameCallbackHandle()` はトラックではなくビデオ単位のメソッドなので
    // 内部的に HTMLVideoElement を生成する
    this.video = document.createElement("video");
    this.video.muted = true;
    this.video.playsInline = true;
    this.video.srcObject = new MediaStream([track]);

    // 処理後の映像フレームを書き込むための canvas を生成する
    // captureStream() を使いたいので OffscreenCanvas にはできない
    const width = track.getSettings().width || 0;
    const height = track.getSettings().height || 0;
    this.canvas = document.createElement("canvas");
    this.canvas.width = width;
    this.canvas.height = height;
    const canvasCtx = this.canvas.getContext("2d");
    if (canvasCtx === null) {
      throw Error("Failed to create 2D canvas context");
    }
    this.canvasCtx = canvasCtx;

    // 作業用キャンバスを生成する
    this.tmpCanvas = createOffscreenCanvas(width, height) as OffscreenCanvas;
    const tmpCanvasCtx = this.tmpCanvas.getContext("2d");
    if (tmpCanvasCtx === null) {
      throw Error("Failed to create 2D canvas context");
    }
    this.tmpCanvasCtx = tmpCanvasCtx;
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
    const { videoWidth: width, videoHeight: height } = this.video;
    resizeCanvasIfNeed(width, height, this.canvas);
    resizeCanvasIfNeed(width, height, this.tmpCanvas);

    if (this.imageDataCallback !== undefined) {
      this.tmpCanvasCtx.drawImage(this.video, 0, 0);
      const image = this.tmpCanvasCtx.getImageData(0, 0, width, height);
      const processedImage = await this.imageDataCallback(image);
      this.canvasCtx.putImageData(processedImage, 0, 0);
    } else if (this.canvasCallback !== undefined) {
      const processedImage = await this.canvasCallback(this.video);
      this.canvasCtx.drawImage(processedImage, 0, 0);
    } else {
      throw new Error("No callback is set");
    }
    // @ts-ignore
    // eslint-disable-next-line
    this.requestVideoFrameCallbackHandle = this.video.requestVideoFrameCallback(() => {
      this.onFrame().catch((e) => console.warn("Error: ", e));
    });
  }
}

// TODO(sile): Safari 16.4 から OffscreenCanvas に対応したので、そのうちにこの関数は削除する
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

function resizeCanvasIfNeed(width: number, height: number, canvas: OffscreenCanvas | HTMLCanvasElement) {
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
}

export { VideoTrackProcessor, ProcessImageDataCallback };
