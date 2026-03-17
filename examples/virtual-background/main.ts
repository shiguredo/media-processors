import { VirtualBackgroundProcessor } from "@shiguredo/virtual-background";
import img from "./background.jpg";

document.addEventListener("DOMContentLoaded", async () => {
  if (!VirtualBackgroundProcessor.isSupported()) {
    alert("Unsupported platform");
    throw new Error("Unsupported platform");
  }

  const assetsPath = ".";
  const processor = new VirtualBackgroundProcessor(assetsPath);
  setInterval(() => {
    const elapsed = processor.getAverageProcessedTimeMs() / 1000;
    document.querySelector("#elapsed").textContent = elapsed.toFixed(4).padStart(4, "0");
    const fps = processor.getFps();
    document.querySelector("#fps").textContent = fps.toFixed(2).padStart(5, "0");
  }, 300);

  async function getUserMedia() {
    const constraints = {
      deviceId: document.querySelector("#videoDevice").value,
      frameRate: { ideal: document.querySelector("#videoFps").value },
      height: document.querySelector("#videoHeight").value,
      width: document.querySelector("#videoWidth").value,
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
      const select = document.querySelector("#videoDevice");
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

    const videoElement = document.querySelector("#video");
    void getUserMedia().then((stream) => {
      videoElement.srcObject = stream;
    });
  }

  function showProcessedVideo() {
    processor.stopProcessing();

    const videoElement = document.querySelector("#video");
    void getUserMedia().then((stream) => {
      const track = stream.getVideoTracks()[0];

      let blurRadius: number;
      let backgroundImage: HTMLImageElement;
      const virtualBackgroundType = document.querySelector("#virtualBackgroundType")!;
      if (virtualBackgroundType === null) {
        return;
      }
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
