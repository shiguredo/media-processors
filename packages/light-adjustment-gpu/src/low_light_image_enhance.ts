import { VideoTrackProcessor } from "@shiguredo/video-track-processor";
import "@tensorflow/tfjs-backend-webgl";
import * as tf from "@tensorflow/tfjs";

interface ImageToImageModelOption {
  modelPath: string;
  inputWidth: number;
  inputHeight: number;
  outputWidth: number;
  outputHeight: number;
  inputConverter?: (tensor: tf.Tensor3D) => tf.Tensor<tf.Rank> | tf.NamedTensorMap | tf.Tensor<tf.Rank>[];
  outputConverter?: (tensor: tf.Tensor | tf.Tensor[] | tf.NamedTensorMap) => tf.Tensor3D;
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
      // if (
      //   outputResizeCanvas.width !== this.modelOption.outputWidth ||
      //   outputResizeCanvas.height !== this.modelOption.outputHeight
      // ) {
      //   outputResizeCanvas.width = this.modelOption.outputWidth;
      //   outputResizeCanvas.height = this.modelOption.outputHeight;
      // }
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
        // if (gl.checkFramebufferStatus(gl.READ_FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
        //   throw new Error(`invalid framebuffer status: ${gl.checkFramebufferStatus(gl.READ_FRAMEBUFFER)}`);
        // }
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
  sciDifficult1280x720 = "sci_difficult_1280x720",
  sciDifficult640x360 = "sci_difficult_640x360",
  sciDifficult640x480 = "sci_difficult_640x480",
  sciDifficult320x240 = "sci_difficult_320x240",
  sciMedium1280x720 = "sci_medium_1280x720",
  sciMedium640x360 = "sci_medium_640x360",
  sciMedium640x480 = "sci_medium_640x480",
  sciMedium320x240 = "sci_medium_320x240",
  sciEasy1280x720 = "sci_easy_1280x720",
  sciEasy640x360 = "sci_easy_640x360",
  sciEasy640x480 = "sci_easy_640x480",
  sciEasy320x240 = "sci_easy_320x240",
  pmn1280x736 = "pmn_1280x736",
}

const outputConverter255 = (outputTensor: tf.Tensor | tf.Tensor[] | tf.NamedTensorMap): tf.Tensor3D => {
  const outputRgb = tf.div(outputTensor as tf.Tensor4D, 255).squeeze();
  const shape = outputRgb.shape as [number, number, number];
  const outputA = tf.fill([shape[0], shape[1], 1], 1.0, "float32");
  return tf.concat3d([outputRgb, outputA] as tf.Tensor3D[], 2);
};

const inputConverterPmn: (img: tf.Tensor3D) => tf.Tensor4D = (img) => {
  const imgA = tf.fill([img.shape[0], img.shape[1], 1], 1.0, "float32") as tf.Tensor3D;
  return tf.expandDims(tf.concat3d([tf.div(img, 255), imgA] as tf.Tensor3D[], 2));
};

const outputConverterPmn = (outputTensor: tf.Tensor | tf.Tensor[] | tf.NamedTensorMap): tf.Tensor3D => {
  return (outputTensor as tf.Tensor4D).squeeze();
};

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
  sci_difficult_1280x720: {
    modelPath: "tfjs_model_sci_difficult_720x1280",
    inputWidth: 1280,
    inputHeight: 720,
    outputWidth: 1280,
    outputHeight: 720,
    outputConverter: outputConverter255,
  },
  sci_difficult_640x360: {
    modelPath: "tfjs_model_sci_difficult_360x640",
    inputWidth: 640,
    inputHeight: 360,
    outputWidth: 640,
    outputHeight: 360,
    outputConverter: outputConverter255,
  },
  sci_difficult_640x480: {
    modelPath: "tfjs_model_sci_difficult_480x640",
    inputWidth: 640,
    inputHeight: 480,
    outputWidth: 640,
    outputHeight: 480,
    outputConverter: outputConverter255,
  },
  sci_difficult_320x240: {
    modelPath: "tfjs_model_sci_difficult_240x320",
    inputWidth: 320,
    inputHeight: 240,
    outputWidth: 320,
    outputHeight: 240,
    outputConverter: outputConverter255,
  },
  sci_medium_1280x720: {
    modelPath: "tfjs_model_sci_medium_720x1280",
    inputWidth: 1280,
    inputHeight: 720,
    outputWidth: 1280,
    outputHeight: 720,
    outputConverter: outputConverter255,
  },
  sci_medium_640x360: {
    modelPath: "tfjs_model_sci_medium_360x640",
    inputWidth: 640,
    inputHeight: 360,
    outputWidth: 640,
    outputHeight: 360,
    outputConverter: outputConverter255,
  },
  sci_medium_640x480: {
    modelPath: "tfjs_model_sci_medium_480x640",
    inputWidth: 640,
    inputHeight: 480,
    outputWidth: 640,
    outputHeight: 480,
    outputConverter: outputConverter255,
  },
  sci_medium_320x240: {
    modelPath: "tfjs_model_sci_medium_240x320",
    inputWidth: 320,
    inputHeight: 240,
    outputWidth: 320,
    outputHeight: 240,
    outputConverter: outputConverter255,
  },
  sci_easy_1280x720: {
    modelPath: "tfjs_model_sci_easy_720x1280",
    inputWidth: 1280,
    inputHeight: 720,
    outputWidth: 1280,
    outputHeight: 720,
    outputConverter: outputConverter255,
  },
  sci_easy_640x360: {
    modelPath: "tfjs_model_sci_easy_360x640",
    inputWidth: 640,
    inputHeight: 360,
    outputWidth: 640,
    outputHeight: 360,
    outputConverter: outputConverter255,
  },
  sci_easy_640x480: {
    modelPath: "tfjs_model_sci_easy_480x640",
    inputWidth: 640,
    inputHeight: 480,
    outputWidth: 640,
    outputHeight: 480,
    outputConverter: outputConverter255,
  },
  sci_easy_320x240: {
    modelPath: "tfjs_model_sci_easy_240x320",
    inputWidth: 320,
    inputHeight: 240,
    outputWidth: 320,
    outputHeight: 240,
    outputConverter: outputConverter255,
  },
  pmn_1280x736: {
    modelPath: "tfjs_model_pmn_736x1280",
    inputWidth: 1280,
    inputHeight: 736,
    outputWidth: 1280,
    outputHeight: 736,
    inputConverter: inputConverterPmn,
    outputConverter: outputConverterPmn,
  },
  pmn_640x384: {
    modelPath: "tfjs_model_pmn_384x640",
    inputWidth: 640,
    inputHeight: 384,
    outputWidth: 640,
    outputHeight: 384,
    inputConverter: inputConverterPmn,
    outputConverter: outputConverterPmn,
  },
};

export class LightAdjustmentGpuProcessor extends ImageToImageVideoProcessor {
  constructor(assetPath: string, modelName: llieModelNames, alpha: number) {
    const model = llieModels[modelName];
    super(Object.assign({}, model, { modelPath: assetPath + model.modelPath }), alpha);
  }
}

export enum superResolutionModelNames {
  rfdn320x180 = "rfdn_320x180",
  fastSrgan180x120 = "fast_srgan_180x120",
}

const superResolutionModels: { [key: string]: ImageToImageModelOption } = {
  rfdn_320x180: {
    modelPath: "tfjs_model_rfdn_180x320",
    inputWidth: 320,
    inputHeight: 180,
    outputWidth: 1280,
    outputHeight: 720,
    outputSizeIsModelOutputSize: true,
  },
  fast_srgan_180x120: {
    modelPath: "tfjs_model_Fast-SRGAN-120x160",
    inputWidth: 160,
    inputHeight: 120,
    outputWidth: 640,
    outputHeight: 480,
    outputSizeIsModelOutputSize: true,
  },
};

export class SuperResolutionProcessor extends ImageToImageVideoProcessor {
  constructor(assetPath: string, modelName: superResolutionModelNames) {
    const model = superResolutionModels[modelName];
    super(Object.assign({}, model, { modelPath: assetPath + model.modelPath }), 1.0);
  }
}
