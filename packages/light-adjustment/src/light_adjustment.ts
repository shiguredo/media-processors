import { VideoTrackProcessor } from "@shiguredo/video-track-processor";

interface LightAdjustmentProcessorOptions {}

class LightAdjustmentProcessor {
  private trackProcessor: VideoTrackProcessor;

  constructor() {
    this.trackProcessor = new VideoTrackProcessor();
  }

  static isSupported(): boolean {
    return VideoTrackProcessor.isSupported();
  }

  stopProcessing() {
    this.trackProcessor.stopProcessing();
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
}

export { LightAdjustmentProcessor, LightAdjustmentProcessorOptions };

// import {
//   SelfieSegmentation,
//   SelfieSegmentationConfig,
//   Results as SelfieSegmentationResults,
// } from "@mediapipe/selfie_segmentation";
// import * as StackBlur from "stackblur-canvas";

// /**
//  * {@link VirtualBackgroundProcessor.startProcessing} メソッドに指定可能なオプション
//  */
// interface VirtualBackgroundProcessorOptions {
//   /**
//    * 仮想背景に使用する画像
//    *
//    * 省略された場合には、元々の背景が使用されます
//    */
//   backgroundImage?: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement | ImageBitmap | OffscreenCanvas;

//   /**
//    * 背景ぼかし効果の半径（pixel）
//    *
//    * 値が大きいほど、ぼかしが強くなります。
//    * デフォルトではぼかしは無効で、これは値として0を指定した場合の挙動と等しいです。
//    */
//   blurRadius?: number;

//   /**
//    * セグメンテーションに使用するモデル
//    *
//    * デフォルトでは"selfie-landscape"が使用されます。
//    * それぞれのモデルの詳細については
//    * [MediaPipe Selfie Segmentation](https://google.github.io/mediapipe/solutions/selfie_segmentation.html)
//    * を参照してください。
//    */
//   segmentationModel?: "selfie-landscape" | "selfie-general";

//   /**
//    * 背景画像のどの領域を使用するかを決定する関数
//    *
//    * 背景画像と処理対象映像のアスペクト比が異なる場合の扱いを決定するために使用されます
//    *
//    * デフォルトでは、背景画像のアスペクト比を維持したまま中央部分を切り抜く {@link cropBackgroundImageCenter} が使われます
//    */
//   backgroundImageRegion?: (videoFrame: ImageSize, backgroundImage: ImageSize) => ImageRegion;
// }

// /**
//  * 画像の幅と高さ
//  */
// interface ImageSize {
//   width: number;
//   height: number;
// }

// /**
//  * 画像の領域（始点とサイズ）
//  */
// interface ImageRegion {
//   x: number;
//   y: number;
//   width: number;
//   height: number;
// }

// /**
//  * 背景画像と処理対象映像のアスペクトが異なる場合に、背景画像の中央部分を切り抜いた領域を返します
//  *
//  * これは {@link VirtualBackgroundProcessorOptions.backgroundImageRegion} オプションのデフォルトの挙動です
//  */
// function cropBackgroundImageCenter(videoFrame: ImageSize, backgroundImage: ImageSize): ImageRegion {
//   let x = 0;
//   let y = 0;
//   let width = backgroundImage.width;
//   let height = backgroundImage.height;

//   const videoFrameRatio = videoFrame.width / videoFrame.height;
//   const backgroundImageRatio = backgroundImage.width / backgroundImage.height;
//   if (backgroundImageRatio < videoFrameRatio) {
//     const newHeight = videoFrame.height * (backgroundImage.width / videoFrame.width);
//     y = Math.round((height - newHeight) / 2);
//     height = Math.round(newHeight);
//   } else if (backgroundImageRatio > videoFrameRatio) {
//     const newWidth = videoFrame.width * (backgroundImage.height / videoFrame.height);
//     x = Math.round((width - newWidth) / 2);
//     width = Math.round(newWidth);
//   }

//   return { x, y, width, height };
// }

// /**
//  * 常に背景画像の全領域を返します
//  *
//  * これは {@link VirtualBackgroundProcessorOptions.backgroundImageRegion} オプションに指定可能な関数で、
//  * 背景画像と処理対象映像のアスペクト比が異なる場合には、背景画像が映像に合わせて引き伸ばされます
//  */
// function fillBackgroundImage(_videoFrame: ImageSize, backgroundImage: ImageSize): ImageRegion {
//   return { x: 0, y: 0, width: backgroundImage.width, height: backgroundImage.height };
// }

// /**
//  * 映像トラックに仮想背景処理を適用するためのプロセッサ
//  */
// class VirtualBackgroundProcessor {
//   private trackProcessor: VideoTrackProcessor;
//   private segmentation: SelfieSegmentation;

//   /**
//    * {@link VirtualBackgroundProcessor} インスタンスを生成します
//    *
//    * @param assetsPath wasm 等のファイルの配置先ディレクトリパスないしURL
//    */
//   constructor(assetsPath: string) {
//     this.trackProcessor = new VideoTrackProcessor();

//     // セグメンテーションモデルのロード準備
//     const config: SelfieSegmentationConfig = {};
//     assetsPath = trimLastSlash(assetsPath);
//     config.locateFile = (file: string) => {
//       return `${assetsPath}/${file}`;
//     };
//     this.segmentation = new SelfieSegmentation(config);
//   }

//   /**
//    * 実行環境が必要な機能をサポートしているかどうかを判定します
//    *
//    * 以下のいずれかが利用可能である必要があります:
//    * - MediaStreamTrack Insertable Streams (aka. Breakout Box)
//    * - HTMLVideoElement.requestVideoFrameCallback
//    *
//    * @returns サポートされているかどうか
//    */
//   static isSupported(): boolean {
//     return VideoTrackProcessor.isSupported();
//   }

//   /**
//    * 仮想背景処理の適用を開始します
//    *
//    * @param track 処理適用対象となる映像トラック
//    * @param options 各種オプション
//    *
//    * @returns 処理適用後の映像トラック
//    *
//    * @throws
//    * 既にあるトラックを処理中の場合には、エラーが送出されます
//    *
//    * 処理中かどうかは {@link VirtualBackgroundProcessor.isProcessing} で判定可能です
//    */
//   async startProcessing(
//     track: MediaStreamVideoTrack,
//     options: VirtualBackgroundProcessorOptions = {}
//   ): Promise<MediaStreamVideoTrack> {
//     const width = track.getSettings().width;
//     const height = track.getSettings().height;
//     if (width === undefined || height === undefined) {
//       throw Error(`Could not retrieve the resolution of the video track: {track}`);
//     }
//     const canvas = createOffscreenCanvas(width, height);
//     const canvasCtx = canvas.getContext("2d", {
//       desynchronized: true,
//       willReadFrequently: true,
//     }) as OffscreenCanvasRenderingContext2D | null;
//     if (canvasCtx === null) {
//       throw Error("Failed to create 2D canvas context");
//     }

//     // Safari での背景ぼかし用に一時作業用の canvas を作っておく
//     //
//     // TODO(sile): Safari が filter に対応したらこの分岐は削除する
//     let blurCanvasCtx: OffscreenCanvasRenderingContext2D | undefined;
//     if (options.blurRadius !== undefined && browser() === "safari") {
//       const ctx = createOffscreenCanvas(width, height).getContext("2d", {
//         desynchronized: true,
//         willReadFrequently: true,
//       });
//       if (ctx === null) {
//         throw Error("Failed to create 2D canvas context");
//       }
//       blurCanvasCtx = ctx as OffscreenCanvasRenderingContext2D;
//     }

//     // セグメンテーションモデルを準備
//     await this.segmentation.initialize();
//     let modelSelection = 1; // `1` means "selfie-landscape".
//     if (options.segmentationModel && options.segmentationModel === "selfie-general") {
//       modelSelection = 0;
//     }
//     this.segmentation.setOptions({ modelSelection });
//     this.segmentation.onResults((results) => {
//       resizeCanvasIfNeed(width, height, canvas);
//       if (blurCanvasCtx !== undefined) {
//         resizeCanvasIfNeed(width, height, blurCanvasCtx.canvas);
//       }
//       this.updateOffscreenCanvas(results, canvasCtx, blurCanvasCtx, options);
//     });

//     // 仮想背景処理を開始
//     return this.trackProcessor.startProcessing(track, async (image: ImageData) => {
//       const { width, height } = image;

//       // @ts-ignore TS2322: 「`image`の型が合っていない」と怒られるけれど、動作はするので一旦無視
//       await this.segmentation.send({ image });

//       return canvasCtx.getImageData(0, 0, width, height);
//     });
//   }

//   /**
//    * 仮想背景処理の適用を停止します
//    *
//    * コンストラクタに渡された映像トラックは閉じないので、
//    * 必要であれば、別途呼び出し側で対処する必要があります
//    */

//   private updateOffscreenCanvas(
//     segmentationResults: SelfieSegmentationResults,
//     canvasCtx: OffscreenCanvasRenderingContext2D,
//     blurCanvasCtx: OffscreenCanvasRenderingContext2D | undefined,
//     options: VirtualBackgroundProcessorOptions
//   ) {
//     const { width, height } = segmentationResults.image;

//     canvasCtx.save();
//     canvasCtx.clearRect(0, 0, width, height);
//     canvasCtx.drawImage(segmentationResults.segmentationMask, 0, 0, width, height);

//     canvasCtx.globalCompositeOperation = "source-in";
//     canvasCtx.drawImage(segmentationResults.image, 0, 0, width, height);

//     // NOTE: mediapipeの例 (https://google.github.io/mediapipe/solutions/selfie_segmentation.html) では、
//     //       "destination-atop"が使われているけれど、背景画像にアルファチャンネルが含まれている場合には、
//     //       "destination-atop"だと透過部分と人物が重なる領域が除去されてしまうので、
//     //       "destination-over"にしている。
//     canvasCtx.globalCompositeOperation = "destination-over";

//     let tmpCanvasCtx = canvasCtx;
//     if (options.blurRadius !== undefined) {
//       if (blurCanvasCtx !== undefined) {
//         tmpCanvasCtx = blurCanvasCtx;
//       } else {
//         tmpCanvasCtx.filter = `blur(${options.blurRadius}px)`;
//       }
//     }

//     if (options.backgroundImage !== undefined) {
//       const decideRegion = options.backgroundImageRegion || cropBackgroundImageCenter;
//       const region = decideRegion({ width, height }, options.backgroundImage);
//       tmpCanvasCtx.drawImage(
//         options.backgroundImage,
//         region.x,
//         region.y,
//         region.width,
//         region.height,
//         0,
//         0,
//         width,
//         height
//       );
//     } else {
//       tmpCanvasCtx.drawImage(segmentationResults.image, 0, 0);
//     }

//     if (blurCanvasCtx !== undefined) {
//       // @ts-ignore
//       StackBlur.canvasRGB(tmpCanvasCtx.canvas, 0, 0, width, height, options.blurRadius);
//       canvasCtx.drawImage(tmpCanvasCtx.canvas, 0, 0, width, height);
//     }

//     canvasCtx.restore();
//   }
// }

// function resizeCanvasIfNeed(width: number, height: number, canvas: OffscreenCanvas | HTMLCanvasElement) {
//   if (canvas.width !== width || canvas.height !== height) {
//     canvas.width = width;
//     canvas.height = height;
//   }
// }

// function trimLastSlash(s: string): string {
//   if (s.slice(-1) === "/") {
//     return s.slice(0, -1);
//   }
//   return s;
// }

// function createOffscreenCanvas(width: number, height: number): OffscreenCanvas | HTMLCanvasElement {
//   if (typeof OffscreenCanvas === "undefined") {
//     // OffscreenCanvas が使えない場合には通常の canvas で代替する
//     const canvas = document.createElement("canvas");
//     canvas.width = width;
//     canvas.height = height;
//     return canvas;
//   } else {
//     return new OffscreenCanvas(width, height);
//   }
// }

// function browser(): string {
//   const ua = window.navigator.userAgent.toLocaleLowerCase();
//   if (ua.indexOf("edge") !== -1) {
//     return "edge";
//   } else if (ua.indexOf("chrome") !== -1 && ua.indexOf("edge") === -1) {
//     return "chrome";
//   } else if (ua.indexOf("safari") !== -1 && ua.indexOf("chrome") === -1) {
//     return "safari";
//   } else if (ua.indexOf("opera") !== -1) {
//     return "opera";
//   } else if (ua.indexOf("firefox") !== -1) {
//     return "firefox";
//   }
//   return "unknown";
// }

// export {
//   VirtualBackgroundProcessorOptions,
//   VirtualBackgroundProcessor,
//   ImageRegion,
//   ImageSize,
//   cropBackgroundImageCenter,
//   fillBackgroundImage,
// };
