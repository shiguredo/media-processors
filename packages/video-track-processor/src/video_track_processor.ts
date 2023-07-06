type ProcessImageCallback = (image: ImageBitmap | HTMLVideoElement) => Promise<HTMLCanvasElement | OffscreenCanvas>;

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

  async startProcessing(track: MediaStreamVideoTrack, callback: ProcessImageCallback): Promise<MediaStreamVideoTrack> {
    if (this.isProcessing()) {
      throw Error("Video track processing has already started.");
    }

    if (BreakoutBoxProcessor.isSupported()) {
      this.trackProcessor = new BreakoutBoxProcessor(track, callback);
    } else if (RequestVideoFrameCallbackProcessor.isSupported()) {
      this.trackProcessor = new RequestVideoFrameCallbackProcessor(track, callback);
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

  getFps(): number {
    return this.trackProcessor?.getFps() ?? 0;
  }

  getAverageProcessedTimeMs(): number {
    return this.trackProcessor?.getAverageProcessedTimeMs() ?? 0;
  }
}

abstract class Processor {
  protected track: MediaStreamVideoTrack;
  protected callback: ProcessImageCallback;

  constructor(track: MediaStreamVideoTrack, callback: ProcessImageCallback) {
    this.track = track;
    this.callback = callback;
  }

  abstract startProcessing(): Promise<MediaStreamVideoTrack>;

  abstract stopProcessing(): void;

  // 統計機能
  private numFramesToRecord = 100;
  private startTimes: number[] = new Array(this.numFramesToRecord).fill(0) as number[];
  private processTimes: number[] = new Array(this.numFramesToRecord).fill(0) as number[];
  private count = 0;
  private currentFps = 0;
  private currentSumProcessedTimeMs = 0;

  getFps(): number {
    return this.currentFps;
  }
  getAverageProcessedTimeMs(): number {
    return this.currentSumProcessedTimeMs / this.numFramesToRecord;
  }

  recordStartFrame() {
    const now = performance.now();
    const idx = this.count % this.numFramesToRecord;
    this.currentFps = this.numFramesToRecord / ((now - this.startTimes[idx]) / 1000);
    this.startTimes[idx] = now;
  }

  recordStopFrame() {
    const now = performance.now();
    const idx = this.count % this.numFramesToRecord;
    const prevTime = this.processTimes[idx];
    const startTime = this.startTimes[idx];
    const processTime = now - startTime;
    this.currentSumProcessedTimeMs = this.currentSumProcessedTimeMs - prevTime + processTime;
    this.processTimes[this.count % this.numFramesToRecord] = processTime;
    this.count++;
  }
}

class BreakoutBoxProcessor extends Processor {
  private abortController: AbortController;
  private generator: MediaStreamVideoTrackGenerator;
  private processor: MediaStreamTrackProcessor<VideoFrame>;

  constructor(track: MediaStreamVideoTrack, callback: ProcessImageCallback) {
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
            this.recordStartFrame();
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
            const { timestamp, duration } = frame;
            // HTMLVideoElementと等価に扱いつつ、mediapipeに渡す際のパフォーマンスが良いのでImageBitmapを使う。
            const image = await createImageBitmap(frame);
            frame.close();
            const processedImageCanvas = await this.callback(image);
            image.close();
            controller.enqueue(new VideoFrame(processedImageCanvas, { timestamp, duration } as VideoFrameInit));
            this.recordStopFrame();
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

  constructor(track: MediaStreamVideoTrack, callback: ProcessImageCallback) {
    super(track, callback);

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
  }

  static isSupported(): boolean {
    return "requestVideoFrameCallback" in HTMLVideoElement.prototype;
  }

  async startProcessing(): Promise<MediaStreamVideoTrack> {
    this.requestVideoFrameCallbackHandle = this.video.requestVideoFrameCallback(() => {
      this.recordStartFrame();
      this.onFrame().catch((e) => console.warn("Error: ", e));
      this.recordStopFrame();
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

    const processedImageCanvas = await this.callback(this.video);
    this.canvasCtx.drawImage(processedImageCanvas, 0, 0);
    // @ts-ignore
    // eslint-disable-next-line
    this.requestVideoFrameCallbackHandle = this.video.requestVideoFrameCallback(() => {
      this.onFrame().catch((e) => console.warn("Error: ", e));
    });
  }
}

function resizeCanvasIfNeed(width: number, height: number, canvas: OffscreenCanvas | HTMLCanvasElement) {
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
}

export { VideoTrackProcessor, ProcessImageCallback };
