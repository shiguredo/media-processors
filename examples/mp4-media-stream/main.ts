import { Mp4MediaStream } from "@shiguredo/mp4-media-stream";

document.addEventListener("DOMContentLoaded", async () => {
  let mp4MediaStream;

  if (!Mp4MediaStream.isSupported()) {
    alert("Unsupported platform");
    throw new Error("Unsupported platform");
  }

  async function load() {
    const input = document.querySelector("#input");
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
      alert(error.message);
      throw error;
    }
  }

  async function play() {
    if (mp4MediaStream === undefined) {
      alert("MP4 ファイルが未選択です");
      return;
    }

    const options = {
      repeat: document.querySelector("#repeat").checked,
    };
    const stream = await mp4MediaStream.play(options);

    const output = document.querySelector("#output");
    output.srcObject = stream;
  }

  async function stop() {
    if (mp4MediaStream === undefined) {
      return;
    }

    await mp4MediaStream.stop();
  }

  document.querySelector("#input").addEventListener("change", load);
  document.querySelector("#play").addEventListener("click", play);
  document.querySelector("#stop").addEventListener("click", stop);
});
