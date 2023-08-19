import { VideoTrackProcessor } from "@shiguredo/video-track-processor";
import "@tensorflow/tfjs-backend-webgl";
import * as tf from "@tensorflow/tfjs";

interface ImageToImageModelOption {
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

abstract class ImageToImageVideoProcessor {
  private trackProcessor: VideoTrackProcessor;
  private modelOption: ImageToImageModelOption;
  private alpha: number;

  constructor(model: ImageToImageModelOption, alpha: number) {
    this.trackProcessor = new VideoTrackProcessor();
    this.modelOption = model;
    this.alpha = alpha;
  }

  setAlpha(alpha: number): void {
    this.alpha = alpha;
  }

  static isSupported(): boolean {
    return VideoTrackProcessor.isSupported();
  }

  async startProcessing(track: MediaStreamVideoTrack): Promise<MediaStreamVideoTrack> {
    const inputResizeCanvas = document.createElement("canvas");
    inputResizeCanvas.width = this.modelOption.inputWidth;
    inputResizeCanvas.height = this.modelOption.inputHeight;
    const inputResizeCanvasCtx = inputResizeCanvas.getContext("2d", { willReadFrequently: true });
    if (inputResizeCanvasCtx === null) {
      throw new Error("Failed to get canvas context");
    }
    const outputResizeCanvas = document.createElement("canvas");
    if (this.modelOption.outputSizeIsModelOutputSize) {
      outputResizeCanvas.width = this.modelOption.outputWidth;
      outputResizeCanvas.height = this.modelOption.outputHeight;
    } else {
      outputResizeCanvas.width = track.getSettings().width ?? 0;
      outputResizeCanvas.height = track.getSettings().height ?? 0;
    }
    const outputResizeCanvasCtx = outputResizeCanvas.getContext("2d");
    if (outputResizeCanvasCtx === null) {
      throw new Error("Failed to get canvas context");
    }

    const glCanvas = document.createElement("canvas");
    glCanvas.width = this.modelOption.outputWidth;
    glCanvas.height = this.modelOption.outputHeight;

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

    const modelUrl = this.modelOption.modelPath + "/model.json";
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
        this.modelOption.inputWidth,
        this.modelOption.inputHeight
      );
      if (
        !this.modelOption.outputSizeIsModelOutputSize &&
        (outputResizeCanvas.width !== image.width || outputResizeCanvas.height !== image.height)
      ) {
        outputResizeCanvas.width = image.width;
        outputResizeCanvas.height = image.height;
      }
      const inputConverter = this.modelOption.inputConverter ?? ((img) => tf.div(tf.expandDims(img), 255.0));
      const output = tf.tidy(() => {
        const img = tf.browser.fromPixels(inputResizeCanvas);
        const inputTensor = inputConverter(img);
        const outputTensor = model.predict(inputTensor);
        if (this.modelOption.outputConverter !== undefined) {
          return this.modelOption.outputConverter(outputTensor);
        } else {
          const outputRgb = (outputTensor as tf.Tensor4D).squeeze();
          const outputA = tf.fill(
            [this.modelOption.outputHeight, this.modelOption.outputWidth, 1],
            this.alpha,
            "float32"
          ) as tf.Tensor3D;
          return tf.concat3d([outputRgb as tf.Tensor3D, outputA], 2);
        }
      });
      const data = output.dataToGPU({ customTexShape: [this.modelOption.outputHeight, this.modelOption.outputWidth] });
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
          this.modelOption.outputWidth,
          this.modelOption.outputHeight,
          0,
          0,
          this.modelOption.outputWidth,
          this.modelOption.outputHeight,
          gl.COLOR_BUFFER_BIT,
          gl.NEAREST
        );
        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
      }
      data.tensorRef.dispose();
      output.dispose();

      if (this.modelOption.outputSizeIsModelOutputSize) {
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

export enum llieModelNames {
  semanticGuidedLlie1284x720 = "semantic_guided_llie_1284x720",
  semanticGuidedLlie648x480 = "semantic_guided_llie_648x480",
  semanticGuidedLlie648x360 = "semantic_guided_llie_648x360",
  semanticGuidedLlie324x240 = "semantic_guided_llie_324x240",
}

const llieModels: { [key: string]: ImageToImageModelOption } = {
  semantic_guided_llie_1284x720: {
    modelPath: "tfjs_model_semantic_guided_llie_720x1284",
    inputWidth: 1284,
    inputHeight: 720,
    outputWidth: 1284,
    outputHeight: 720,
  },
  semantic_guided_llie_648x480: {
    modelPath: "tfjs_model_semantic_guided_llie_480x648",
    inputWidth: 648,
    inputHeight: 480,
    outputWidth: 648,
    outputHeight: 480,
  },
  semantic_guided_llie_648x360: {
    modelPath: "tfjs_model_semantic_guided_llie_360x648",
    inputWidth: 648,
    inputHeight: 360,
    outputWidth: 648,
    outputHeight: 360,
  },
  semantic_guided_llie_324x240: {
    modelPath: "tfjs_model_semantic_guided_llie_240x324",
    inputWidth: 648,
    inputHeight: 360,
    outputWidth: 648,
    outputHeight: 360,
  },
};

export class LightAdjustmentGpuProcessor extends ImageToImageVideoProcessor {
  constructor(assetPath: string, modelName: llieModelNames, alpha: number) {
    const model = llieModels[modelName];
    super(Object.assign({}, model, { modelPath: assetPath + model.modelPath }), alpha);
  }
}
