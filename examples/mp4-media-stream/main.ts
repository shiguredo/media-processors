import { Mp4MediaStream } from "@shiguredo/mp4-media-stream";

document.addEventListener("DOMContentLoaded", () => {
  let mp4MediaStream: Mp4MediaStream | undefined;

  if (!Mp4MediaStream.isSupported()) {
    alert("Unsupported platform");
    throw new Error("Unsupported platform");
  }

  async function load() {
    const input = document.querySelector<HTMLInputElement>("#input");
    if (input === null) {
      return;
    }
    const { files } = input;
    if (files === null || files.length === 0) {
      return;
    }
    const file = files[0];

    if (mp4MediaStream !== undefined) {
      await mp4MediaStream.stop();
    }

    try {
      mp4MediaStream = await Mp4MediaStream.load(file);
    } catch (error) {
      alert((error as Error).message);
      throw error;
    }
  }

  async function play() {
    if (mp4MediaStream === undefined) {
      alert("MP4 ファイルが未選択です");
      return;
    }

    const repeatInput = document.querySelector<HTMLInputElement>("#repeat");
    const options = {
      repeat: repeatInput === null ? false : repeatInput.checked,
    };
    const stream = await mp4MediaStream.play(options);

    const output = document.querySelector<HTMLVideoElement>("#output");
    if (output === null) {
      return;
    }
    output.srcObject = stream;
  }

  async function stop() {
    if (mp4MediaStream === undefined) {
      return;
    }

    await mp4MediaStream.stop();
  }

  const inputButton = document.querySelector("#input");
  if (inputButton !== null) {
    inputButton.addEventListener("change", () => {
      void load();
    });
  }
  const playButton = document.querySelector("#play");
  if (playButton !== null) {
    playButton.addEventListener("click", () => {
      void play();
    });
  }
  const stopButton = document.querySelector("#stop");
  if (stopButton !== null) {
    stopButton.addEventListener("click", () => {
      void stop();
    });
  }
});
