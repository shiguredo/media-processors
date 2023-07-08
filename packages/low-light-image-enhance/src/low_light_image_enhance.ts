import { VideoTrackProcessor } from "@shiguredo/video-track-processor";
import { InferenceSession, Tensor } from "onnxruntime-web";
import "@tensorflow/tfjs-backend-webgl";
import * as tf from "@tensorflow/tfjs";

class TfjsLowLightImageEnhanceProcessor {
  private trackProcessor: VideoTrackProcessor;
  private assetPath: string;
  private frameBuffer: WebGLFramebuffer | null = null;
  private gl: WebGL2RenderingContext | null = null;
  constructor(assetPath: string) {
    this.trackProcessor = new VideoTrackProcessor();
    this.assetPath = assetPath;
  }

  static isSupported(): boolean {
    return VideoTrackProcessor.isSupported();
  }

  async startProcessing(track: MediaStreamVideoTrack): Promise<MediaStreamVideoTrack> {
    const modelWidth = 1284;
    const modelHeight = 720;
    const resizeCanvas = document.createElement("canvas");
    resizeCanvas.width = modelWidth;
    resizeCanvas.height = modelHeight;
    const resizeCanvasCtx = resizeCanvas.getContext("2d", { willReadFrequently: true });
    if (resizeCanvasCtx === null) {
      throw new Error("Failed to get canvas context");
    }
    const outputResizeCanvas = document.createElement("canvas");
    outputResizeCanvas.width = track.getSettings().width ?? 0;
    outputResizeCanvas.height = track.getSettings().height ?? 0;
    const outputResizeCanvasCtx = outputResizeCanvas.getContext("2d");
    if (outputResizeCanvasCtx === null) {
      throw new Error("Failed to get canvas context");
    }

    const outputCanvas = document.createElement("canvas");
    outputCanvas.width = modelWidth;
    outputCanvas.height = modelHeight;

    const gl =
      this.gl ??
      outputCanvas.getContext("webgl2", {
        alpha: true,
        antialias: false,
        premultipliedAlpha: false,
        preserveDrawingBuffer: false,
        depth: false,
        stencil: false,
        failIfMajorPerformanceCaveat: true,
        powerPreference: "low-power",
      });
    this.gl = gl;
    if (gl === null) {
      throw new Error("Failed to get canvas/gl context");
    }

    const customBackendName = "custom-webgl";

    if (tf.getBackend() !== customBackendName) {
      const kernels = tf.getKernelsForBackend("webgl");
      kernels.forEach((kernelConfig) => {
        const newKernelConfig = { ...kernelConfig, backendName: customBackendName };
        tf.registerKernel(newKernelConfig);
      });

      tf.registerBackend(customBackendName, () => {
        return new tf.MathBackendWebGL(new tf.GPGPUContext(gl));
      });
    }

    await tf.setBackend(customBackendName);

    const modelUrl = this.assetPath + "/model.json";
    const model = await tf.loadGraphModel(modelUrl);

    this.frameBuffer ??= gl.createFramebuffer();

    // eslint-disable-next-line @typescript-eslint/require-await
    return this.trackProcessor.startProcessing(track, async (image: ImageBitmap | HTMLVideoElement) => {
      resizeCanvasCtx.drawImage(image, 0, 0, modelWidth, modelHeight);
      if (outputResizeCanvas.width !== image.width || outputResizeCanvas.height !== image.height) {
        outputResizeCanvas.width = image.width;
        outputResizeCanvas.height = image.height;
      }
      const output = tf.tidy(() => {
        const img = tf.browser.fromPixels(resizeCanvas);
        const inputTensor = tf.div(tf.expandDims(img), 255.0);
        const outputTensor = model.predict(inputTensor) as tf.Tensor4D;
        // tf.browser.draw(outputTensor.squeeze() as tf.Tensor3D, canvas); // WebGLバックエンドだと使えない
        const outputRgb = outputTensor.squeeze();
        const outputA = tf.fill([modelHeight, modelWidth, 1], 1.0, "float32") as tf.Tensor3D;
        return tf.concat3d([outputRgb as tf.Tensor3D, outputA], 2);
      });
      const data = output.dataToGPU({ customTexShape: [modelHeight, modelWidth] });
      if (data.texture !== undefined) {
        gl.bindTexture(gl.TEXTURE_2D, data.texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.frameBuffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, data.texture, 0);
        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.frameBuffer);
        gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
        gl.clearBufferfv(gl.COLOR, 0, [0.0, 0.0, 0.0, 1.0]);
        if (gl.checkFramebufferStatus(gl.READ_FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
          throw new Error(`invalid framebuffer status: ${gl.checkFramebufferStatus(gl.READ_FRAMEBUFFER)}`);
        }
        gl.blitFramebuffer(
          0,
          0,
          modelWidth,
          modelHeight,
          0,
          0,
          modelWidth,
          modelHeight,
          gl.COLOR_BUFFER_BIT,
          gl.NEAREST
        );
        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
      }
      data.tensorRef.dispose();
      output.dispose();

      outputResizeCanvasCtx.drawImage(outputCanvas, 0, 0, outputResizeCanvas.width, outputResizeCanvas.height);

      return outputResizeCanvas;
    });
  }

  stopProcessing() {
    this.trackProcessor.stopProcessing();
    if (this.gl !== null) {
      this.gl.deleteFramebuffer(this.frameBuffer);
      this.frameBuffer = null;
    }
  }

  getFps() {
    return this.trackProcessor.getFps();
  }

  getAverageProcessedTimeMs() {
    return this.trackProcessor.getAverageProcessedTimeMs();
  }
}

class OnnxLowLightImageEnhanceProcessor {
  private trackProcessor: VideoTrackProcessor;
  private assetPath: string;
  constructor(assetPath: string) {
    this.trackProcessor = new VideoTrackProcessor();
    this.assetPath = assetPath;
  }

  static isSupported(): boolean {
    return VideoTrackProcessor.isSupported();
  }

  async startProcessing(track: MediaStreamVideoTrack): Promise<MediaStreamVideoTrack> {
    const initialWidth = track.getSettings().width || 0;
    const initialHeight = track.getSettings().height || 0;
    const { width: initialNewWidth, height: initialNewHeight } = getInputSize(initialWidth, initialHeight);
    const canvas = new OffscreenCanvas(initialNewWidth, initialNewHeight);
    const canvasCtx = canvas.getContext("2d", { willReadFrequently: true });
    if (canvasCtx === null) {
      throw new Error("Failed to get canvas context");
    }
    const model = await (await fetch(this.assetPath + "/semantic_guided_llie_HxW.onnx")).arrayBuffer();
    const session = await InferenceSession.create(model, { executionProviders: ["wasm"] });

    return this.trackProcessor.startProcessing(track, async (image: ImageBitmap | HTMLVideoElement) => {
      const { width: newWidth, height: newHeight } = getInputSize(image.width, image.height);
      if (canvas.width !== newWidth || canvas.height !== newHeight) {
        canvas.width = newWidth;
        canvas.height = newHeight;
      }
      canvasCtx.drawImage(image, 0, 0, newWidth, newHeight);
      const imageData = canvasCtx.getImageData(0, 0, canvas.width, canvas.height);
      const tensor = createTensorFromImageData(imageData);
      const feeds: Record<string, Tensor> = {};
      feeds[session.inputNames[0]] = tensor;
      const output = (await session.run(feeds))[session.outputNames[0]];
      const outputImageData = createImageDataFromTensor(output);
      canvasCtx.putImageData(outputImageData, 0, 0);

      return canvas;
    });
  }

  stopProcessing() {
    this.trackProcessor.stopProcessing();
  }

  getFps() {
    return this.trackProcessor.getFps();
  }

  getAverageProcessedTimeMs() {
    return this.trackProcessor.getAverageProcessedTimeMs();
  }
}

function createTensorFromImageData(imageData: ImageData): Tensor {
  const length = imageData.data.length / 4;
  const data = new Float32Array(length * 3);
  for (let i = 0; i < length; i++) {
    data[i] = imageData.data[i * 4] / 255.0;
    data[length + i] = imageData.data[i * 4 + 1] / 255.0;
    data[length * 2 + i] = imageData.data[i * 4 + 2] / 255.0;
  }
  return new Tensor("float32", data, [1, 3, imageData.height, imageData.width]);
}

function createImageDataFromTensor(tensor: Tensor): ImageData {
  const inputData = tensor.data as Float32Array;
  const length = tensor.data.length / 3;
  const data = new Uint8ClampedArray(length * 4);
  for (let i = 0; i < length; i++) {
    data[i * 4] = inputData[i] * 255;
    data[i * 4 + 1] = inputData[length + i] * 255;
    data[i * 4 + 2] = inputData[length * 2 + i] * 255;
    data[i * 4 + 3] = 255;
  }

  return new ImageData(data, tensor.dims[3], tensor.dims[2]);
}

function getInputSize(width: number, height: number): { width: number; height: number } {
  return { width, height };
  // return {
  //   width: Math.ceil(width / 32) * 32,
  //   height: Math.ceil(height / 32) * 32,
  // };
}

export { OnnxLowLightImageEnhanceProcessor, TfjsLowLightImageEnhanceProcessor };
