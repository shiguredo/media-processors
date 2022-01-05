import {
  SelfieSegmentation,
  SelfieSegmentationConfig,
  Results as SelfieSegmentationResults,
} from "@mediapipe/selfie_segmentation";

interface SelfieSegmentationOptions {
  modelType?: "landscape" | "general";
}

interface VirtualBackgroundProcessorOptions {
  assetsPath?: string;
  backgroundImage?: CanvasImageSourceWebCodecs;
  blurRadius?: number;
  selfieSegmentationOptions?: SelfieSegmentationOptions;
}

class VirtualBackgroundProcessor {
  private options: VirtualBackgroundProcessorOptions;
  private track: MediaStreamVideoTrack;
  private canvas: OffscreenCanvas;
  private canvasCtx: OffscreenCanvasRenderingContext2D;
  private segmentation: SelfieSegmentation;
  private abortController?: AbortController;

  constructor(track: MediaStreamVideoTrack, options: VirtualBackgroundProcessorOptions = {}) {
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

    // セグメンテーションモデルの初期化
    const config: SelfieSegmentationConfig = {};
    const assetsPath = options.assetsPath || ".";
    config.locateFile = (file: string) => {
      return `${assetsPath}/${file}`;
    };
    this.segmentation = new SelfieSegmentation(config);
    let modelSelection = 1; // `1` means "landscape".
    if (options.selfieSegmentationOptions && options.selfieSegmentationOptions.modelType === "general") {
      modelSelection = 0;
    }
    this.segmentation.setOptions({
      modelSelection,
    });
    this.segmentation.onResults((results) => {
      this.updateOffscreenCanvas(results);
    });
  }

  static isSupported(): boolean {
    return !(typeof MediaStreamTrackProcessor === "undefined" || typeof MediaStreamTrackGenerator === "undefined");
  }

  startProcessing(): Promise<MediaStreamTrack> {
    this.abortController = new AbortController();
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
          console.log("Shutting down streams after abort.");
        } else {
          console.warn("Error from stream transform:", e);
        }
        processor.readable.cancel(e).catch((e) => {
          console.warn("Failed to cancel `MediaStreamTrackProcessor`:", e);
        });
        generator.writable.abort(e).catch((e) => {
          console.warn("Failed to abort `MediaStreamTrackGenerator`:", e);
        });
      });

    return Promise.resolve(generator);
  }

  stopProcessing() {
    if (this.abortController !== undefined) {
      this.abortController.abort();
      this.abortController = undefined;
    }
  }

  private async transform(frame: VideoFrame, controller: TransformStreamDefaultController<VideoFrame>): Promise<void> {
    const image = await createImageBitmap(frame);

    // @ts-ignore TS2322: 「`image`の型が合っていない」と怒られるけれど、動作はするので一旦無視
    await this.segmentation.send({ image });
    image.close();
    frame.close();

    // NOTE: この時点で`this.canvas`は`frame`を反映した内容に更新されている

    // @ts-ignore TS2345: 「`canvas`の型が合っていない」と怒られるけれど、動作はするので一旦無視。
    controller.enqueue(new VideoFrame(this.canvas));
  }

  private updateOffscreenCanvas(segmentationResults: SelfieSegmentationResults) {
    this.canvasCtx.save();
    this.canvasCtx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.canvasCtx.drawImage(segmentationResults.segmentationMask, 0, 0, this.canvas.width, this.canvas.height);

    this.canvasCtx.globalCompositeOperation = "source-in";
    this.canvasCtx.drawImage(segmentationResults.image, 0, 0, this.canvas.width, this.canvas.height);

    this.canvasCtx.globalCompositeOperation = "destination-atop";

    if (this.options.blurRadius !== undefined) {
      this.canvasCtx.filter = `blur(${this.options.blurRadius}px)`;
    }
    if (this.options.backgroundImage !== undefined) {
      this.canvasCtx.drawImage(this.options.backgroundImage, 0, 0, this.canvas.width, this.canvas.height);
    } else {
      this.canvasCtx.drawImage(segmentationResults.image, 0, 0);
    }

    this.canvasCtx.restore();
  }
}

export { VirtualBackgroundProcessorOptions, VirtualBackgroundProcessor, SelfieSegmentationOptions };
