import { VideoTrackProcessor } from "@shiguredo/video-track-processor";
import { InferenceSession, Tensor } from "onnxruntime-web";
import '@tensorflow/tfjs-backend-webgl';
import * as tf from '@tensorflow/tfjs';

class TfjsLowLightImageEnhanceProcessor {
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
    const modelWidth = 1284;
    const modelHeight = 720;
    const canvas = document.createElement("canvas");
    canvas.width = modelWidth;
    canvas.height = modelHeight;
    const canvasCtx = canvas.getContext("2d", {willReadFrequently: true});
    if (canvasCtx === null) {
      throw new Error("Failed to get canvas context");
    }
    await tf.setBackend("webgl");
    const modelUrl = this.assetPath + "/model.json";
    const model = await tf.loadGraphModel(modelUrl);

    return this.trackProcessor.startProcessing(track, async (image: ImageBitmap | HTMLVideoElement) => {
      canvasCtx.drawImage(image, 0, 0, modelWidth, modelHeight);
      const output = tf.tidy(() => {
        const img = tf.browser.fromPixels(canvas);
        const inputTensor = tf.div(tf.expandDims(img), 255.0);
        const outputTensor = model.predict(inputTensor) as tf.Tensor4D;
        // tf.browser.draw(outputTensor.squeeze() as tf.Tensor3D, canvas); // WebGLバックエンドだと使えない
        return outputTensor.squeeze() as tf.Tensor3D;
      });
      await tf.browser.toPixels(output, canvas);
      output.dispose();

      return canvas;
    });
  }

  stopProcessing() {
    this.trackProcessor.stopProcessing();
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
    const canvasCtx = canvas.getContext("2d", {willReadFrequently: true});
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
  return { width, height }
  // return {
  //   width: Math.ceil(width / 32) * 32,
  //   height: Math.ceil(height / 32) * 32,
  // };
}

export { OnnxLowLightImageEnhanceProcessor, TfjsLowLightImageEnhanceProcessor as TfliteLowLightImageEnhanceProcessor };
