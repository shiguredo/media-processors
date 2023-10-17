import { VideoTrackProcessor } from "@shiguredo/video-track-processor";
import "@tensorflow/tfjs-backend-webgl";
import * as tf from "@tensorflow/tfjs";

/**
 * ImageToImageVideoProcessor で使うモデルのオプション
 */
export interface ImageToImageModelOptions {
  modelPath: string;
  inputWidth: number;
  inputHeight: number;
  // LLIEではinputWidth/Height = outputWidth/Heightだが、超解像を使う場合には必要なので作っておく
  outputWidth: number;
  outputHeight: number;
  // Semantic Guided Low-light Image Enhancementでは必要ないが、他のモデルを使う場合には必要なので作っておく
  inputConverter?: (tensor: tf.Tensor3D) => tf.Tensor<tf.Rank> | tf.NamedTensorMap | tf.Tensor<tf.Rank>[];
  outputConverter?: (tensor: tf.Tensor | tf.Tensor[] | tf.NamedTensorMap) => tf.Tensor3D;
  // 超解像用
  outputSizeIsModelOutputSize?: boolean;
}

const customBackendName = "shiguredo-custom-webgl";

/**
 * 動画ストリームに対して、画像から画像への変換を行う推論処理をtfjsで行う際の処理を共通化したユーティリティクラス
 * 利用側はモデルファイルのパスと解像度などの情報(ImageToImageModelOptions)を渡すだけで良い
 * WebGLを使いCPUを介さずにGPU上で推論結果の描画・エンコーダへの受け渡しを行う
 */
export abstract class ImageToImageVideoProcessor {
  /**
   * 内部で使用するVideoTrackProcessorのインスタンスです
   */
  private trackProcessor: VideoTrackProcessor;
  /**
   * 使用するモデルのオプションです
   */
  private modelOptions: ImageToImageModelOptions;
  /*
   * 補正の強さ。元画像と補正画像をブレンディングする際の比率を0.0 から 1.0 の範囲で指定します
   */
  private strength: number;

  constructor(model: ImageToImageModelOptions, strength: number) {
    this.trackProcessor = new VideoTrackProcessor();
    this.modelOptions = model;
    this.strength = strength;
  }

  setStrength(strength: number): void {
    this.strength = strength;
  }

  static isSupported(): boolean {
    return VideoTrackProcessor.isSupported();
  }

  async startProcessing(track: MediaStreamVideoTrack): Promise<MediaStreamVideoTrack> {
    const inputResizeCanvas = document.createElement("canvas");
    inputResizeCanvas.width = this.modelOptions.inputWidth;
    inputResizeCanvas.height = this.modelOptions.inputHeight;
    const inputResizeCanvasCtx = inputResizeCanvas.getContext("2d", { willReadFrequently: true });
    if (inputResizeCanvasCtx === null) {
      throw new Error("Failed to get canvas context");
    }
    const outputResizeCanvas = document.createElement("canvas");
    if (this.modelOptions.outputSizeIsModelOutputSize) {
      outputResizeCanvas.width = this.modelOptions.outputWidth;
      outputResizeCanvas.height = this.modelOptions.outputHeight;
    } else {
      outputResizeCanvas.width = track.getSettings().width ?? 0;
      outputResizeCanvas.height = track.getSettings().height ?? 0;
    }
    const outputResizeCanvasCtx = outputResizeCanvas.getContext("2d");
    if (outputResizeCanvasCtx === null) {
      throw new Error("Failed to get canvas context");
    }

    const glCanvas = document.createElement("canvas");
    glCanvas.width = this.modelOptions.outputWidth;
    glCanvas.height = this.modelOptions.outputHeight;

    const gl = glCanvas.getContext("webgl2", {
      alpha: true,
      antialias: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
      depth: false,
      stencil: false,
      failIfMajorPerformanceCaveat: true,
      powerPreference: "low-power",
    });
    if (gl === null) {
      throw new Error("Failed to get canvas/gl context");
    }

    if (tf.getKernelsForBackend(customBackendName).length === 0) {
      const kernels = tf.getKernelsForBackend("webgl");
      kernels.forEach((kernelConfig) => {
        const newKernelConfig = { ...kernelConfig, backendName: customBackendName };
        tf.registerKernel(newKernelConfig);
      });
    }
    tf.registerBackend(customBackendName, () => {
      return new tf.MathBackendWebGL(new tf.GPGPUContext(gl));
    });

    await tf.setBackend(customBackendName);

    const modelUrl = this.modelOptions.modelPath + "/model.json";
    const model = await tf.loadGraphModel(modelUrl);

    const frameBuffer = gl.createFramebuffer();

    // eslint-disable-next-line @typescript-eslint/require-await
    return this.trackProcessor.startProcessing(track, async (image: ImageBitmap | HTMLVideoElement) => {
      inputResizeCanvasCtx.drawImage(
        image,
        0,
        0,
        image.width,
        image.height,
        0,
        0,
        this.modelOptions.inputWidth,
        this.modelOptions.inputHeight
      );
      if (
        !this.modelOptions.outputSizeIsModelOutputSize &&
        (outputResizeCanvas.width !== image.width || outputResizeCanvas.height !== image.height)
      ) {
        outputResizeCanvas.width = image.width;
        outputResizeCanvas.height = image.height;
      }
      const inputConverter = this.modelOptions.inputConverter ?? ((img) => tf.div(tf.expandDims(img), 255.0));
      const output = tf.tidy(() => {
        const img = tf.browser.fromPixels(inputResizeCanvas);
        const inputTensor = inputConverter(img);
        const outputTensor = model.predict(inputTensor);
        if (this.modelOptions.outputConverter !== undefined) {
          return this.modelOptions.outputConverter(outputTensor);
        } else {
          const outputRgb = (outputTensor as tf.Tensor4D).squeeze();
          const outputA = tf.fill(
            [this.modelOptions.outputHeight, this.modelOptions.outputWidth, 1],
            this.strength,
            "float32"
          ) as tf.Tensor3D;
          return tf.concat3d([outputRgb as tf.Tensor3D, outputA], 2);
        }
      });
      const data = output.dataToGPU({
        customTexShape: [this.modelOptions.outputHeight, this.modelOptions.outputWidth],
      });
      if (data.texture !== undefined) {
        gl.bindTexture(gl.TEXTURE_2D, data.texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, data.texture, 0);
        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, frameBuffer);
        gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
        gl.clearBufferfv(gl.COLOR, 0, [0.0, 0.0, 0.0, 1.0]);
        gl.blitFramebuffer(
          0,
          0,
          this.modelOptions.outputWidth,
          this.modelOptions.outputHeight,
          0,
          0,
          this.modelOptions.outputWidth,
          this.modelOptions.outputHeight,
          gl.COLOR_BUFFER_BIT,
          gl.NEAREST
        );
        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
      }
      data.tensorRef.dispose();
      output.dispose();

      if (this.modelOptions.outputSizeIsModelOutputSize) {
        return glCanvas;
      } else {
        outputResizeCanvasCtx.drawImage(image, 0, 0);
        outputResizeCanvasCtx.drawImage(glCanvas, 0, 0, outputResizeCanvas.width, outputResizeCanvas.height);
        return outputResizeCanvas;
      }
    });
  }

  stopProcessing() {
    this.trackProcessor.stopProcessing();
    if (tf.getBackend() === customBackendName) {
      tf.removeBackend(customBackendName);
    }
  }

  getFps() {
    return this.trackProcessor.getFps();
  }

  getAverageProcessedTimeMs() {
    return this.trackProcessor.getAverageProcessedTimeMs();
  }
}
