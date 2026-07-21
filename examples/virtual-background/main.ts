import { VirtualBackgroundProcessor } from "@shiguredo/virtual-background";
import img from "./background.jpg";

document.addEventListener("DOMContentLoaded", () => {
  if (!VirtualBackgroundProcessor.isSupported()) {
    alert("Unsupported platform");
    throw new Error("Unsupported platform");
  }

  const assetsPath = ".";
  const processor = new VirtualBackgroundProcessor(assetsPath);

  const elapsedElement = document.querySelector("#elapsed");
  const fpsElement = document.querySelector("#fps");
  setInterval(() => {
    if (elapsedElement !== null) {
      const elapsed = processor.getAverageProcessedTimeMs() / 1000;
      elapsedElement.textContent = elapsed.toFixed(4).padStart(4, "0");
    }
    if (fpsElement !== null) {
      const fps = processor.getFps();
      fpsElement.textContent = fps.toFixed(2).padStart(5, "0");
    }
  }, 300);

  async function getUserMedia() {
    const deviceSelect = document.querySelector<HTMLSelectElement>("#videoDevice");
    const fpsInput = document.querySelector<HTMLInputElement>("#videoFps");
    const heightInput = document.querySelector<HTMLInputElement>("#videoHeight");
    const widthInput = document.querySelector<HTMLInputElement>("#videoWidth");

    const constraints = {
      deviceId: deviceSelect === null ? undefined : deviceSelect.value,
      frameRate: { ideal: fpsInput === null ? 30 : Number(fpsInput.value) },
      height: heightInput === null ? 480 : Number(heightInput.value),
      width: widthInput === null ? 640 : Number(widthInput.value),
    };
    return navigator.mediaDevices.getUserMedia({ video: constraints }).then((result) => {
      updateDeviceList();
      return result;
    });
  }

  let isFirst = true;
  function updateDeviceList() {
    if (!isFirst) {
      return;
    }
    isFirst = false;

    void navigator.mediaDevices.enumerateDevices().then((devices) => {
      const videoDevices = devices.filter((device) => device.kind === "videoinput" && device.label);
      const select = document.querySelector<HTMLSelectElement>("#videoDevice");
      if (select === null) {
        return;
      }
      videoDevices.forEach((device) => {
        const option = document.createElement("option");
        option.value = device.deviceId;
        option.text = device.label;
        select.append(option);
      });
    });
  }

  function showOriginalVideo() {
    processor.stopProcessing();

    const videoElement = document.querySelector<HTMLVideoElement>("#video");
    if (videoElement === null) {
      return;
    }
    void getUserMedia().then((stream) => {
      videoElement.srcObject = stream;
    });
  }

  function showProcessedVideo() {
    processor.stopProcessing();

    const videoElement = document.querySelector<HTMLVideoElement>("#video");
    if (videoElement === null) {
      return;
    }
    void getUserMedia().then((stream) => {
      const track = stream.getVideoTracks()[0];
      if (track === undefined) {
        return;
      }

      const virtualBackgroundType =
        document.querySelector<HTMLSelectElement>("#virtualBackgroundType");
      if (virtualBackgroundType === null) {
        return;
      }

      let blurRadius = 0;
      let backgroundImage: HTMLImageElement | undefined;
      switch (virtualBackgroundType.value) {
        case "blur-5": {
          blurRadius = 5;
          break;
        }
        case "blur-15": {
          blurRadius = 15;
          break;
        }
        case "image": {
          backgroundImage = new Image();
          backgroundImage.src = img;
          break;
        }
        default: {
          return;
        }
      }

      const options = { backgroundImage, blurRadius };
      void processor.startProcessing(track, options).then((processed_track) => {
        videoElement.srcObject = new MediaStream([processed_track]);
      });
    });
  }

  document.querySelector("#virtualBackgroundOn")?.addEventListener("click", showProcessedVideo);
  document.querySelector("#virtualBackgroundOff")?.addEventListener("click", showOriginalVideo);

  showOriginalVideo();
});
