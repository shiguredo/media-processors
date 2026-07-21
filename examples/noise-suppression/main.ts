import { NoiseSuppressionProcessor } from "@shiguredo/noise-suppression";

document.addEventListener("DOMContentLoaded", () => {
  if (!NoiseSuppressionProcessor.isSupported()) {
    alert("Unsupported platform");
    throw new Error("Unsupported platform");
  }

  const processor = new NoiseSuppressionProcessor();

  let audioCtx: AudioContext | undefined;
  let analyserOriginal: AnalyserNode | undefined;
  let analyserProcessed: AnalyserNode | undefined;
  let sourceOriginal: MediaStreamAudioSourceNode | undefined;
  let sourceProcessed: MediaStreamAudioSourceNode | undefined;

  function initAudioAnalysersIfNeed() {
    if (audioCtx === undefined) {
      const AudioContextClass: typeof AudioContext =
        window.AudioContext ||
        (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext ||
        AudioContext;
      audioCtx = new AudioContextClass();

      analyserOriginal = audioCtx.createAnalyser();
      const originalCanvas = document.querySelector<HTMLCanvasElement>("#oscilloscopeOriginal");
      if (originalCanvas !== null) {
        visualize(analyserOriginal, originalCanvas);
      }

      analyserProcessed = audioCtx.createAnalyser();
      const processedCanvas = document.querySelector<HTMLCanvasElement>("#oscilloscopeProcessed");
      if (processedCanvas !== null) {
        visualize(analyserProcessed, processedCanvas);
      }
    }
  }

  async function getUserMedia() {
    const constraints = {
      audio: {
        channelCount: { exact: 1 },
        sampleRate: { ideal: 48_000 },
        sampleSize: { ideal: 480 },
      },
    };
    return navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
      initAudioAnalysersIfNeed();
      if (audioCtx === undefined || analyserOriginal === undefined) {
        return stream;
      }

      if (sourceOriginal !== undefined) {
        sourceOriginal.disconnect();
      }
      sourceOriginal = audioCtx.createMediaStreamSource(stream);
      sourceOriginal.connect(analyserOriginal);

      return stream;
    });
  }

  function playOriginalAudio() {
    processor.stopProcessing();

    const audioElement = document.querySelector<HTMLAudioElement>("#audio");
    if (audioElement === null) {
      return;
    }
    void getUserMedia().then((stream) => {
      if (sourceProcessed !== undefined) {
        sourceProcessed.disconnect();
        sourceProcessed = undefined;
      }
      audioElement.srcObject = stream;
    });
  }

  function playProcessedAudio() {
    processor.stopProcessing();

    const audioElement = document.querySelector<HTMLAudioElement>("#audio");
    if (audioElement === null) {
      return;
    }
    void getUserMedia().then((stream) => {
      const track = stream.getAudioTracks()[0];
      if (track === undefined) {
        return;
      }
      void processor.startProcessing(track).then((processed_track) => {
        if (audioCtx === undefined || analyserProcessed === undefined) {
          return;
        }
        const stream = new MediaStream([processed_track]);

        if (sourceProcessed !== undefined) {
          sourceProcessed.disconnect();
        }
        sourceProcessed = audioCtx.createMediaStreamSource(stream);
        sourceProcessed.connect(analyserProcessed);

        audioElement.srcObject = stream;
      });
    });
  }

  function stopAudio() {
    const audioElement = document.querySelector<HTMLAudioElement>("#audio");
    if (audioElement === null) {
      return;
    }
    audioElement.pause();

    if (sourceOriginal !== undefined) {
      sourceOriginal.disconnect();
      sourceOriginal = undefined;
    }
    if (sourceProcessed !== undefined) {
      sourceProcessed.disconnect();
      sourceProcessed = undefined;
    }
  }

  function visualize(analyser: AnalyserNode, canvas: HTMLCanvasElement) {
    requestAnimationFrame(() => {
      visualize(analyser, canvas);
    });

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteTimeDomainData(dataArray);

    const canvasCtx = canvas.getContext("2d");
    if (canvasCtx === null) {
      return;
    }
    canvasCtx.fillStyle = "rgb(200, 200, 200)";
    canvasCtx.fillRect(0, 0, canvas.width, canvas.height);

    let silence = true;
    for (const sample of dataArray) {
      if (sample !== 128) {
        silence = false;
        break;
      }
    }
    if (silence) {
      return;
    }

    canvasCtx.lineWidth = 2;
    canvasCtx.strokeStyle = "rgb(0, 0, 0)";
    canvasCtx.beginPath();
    const sliceWidth = canvas.width / bufferLength;
    let x = 0;
    for (let i = 0; i < bufferLength; i++) {
      const v = dataArray[i] / 128;
      const y = (v * canvas.height) / 2;

      if (i === 0) {
        canvasCtx.moveTo(x, y);
      } else {
        canvasCtx.lineTo(x, y);
      }

      x += sliceWidth;
    }
    canvasCtx.lineTo(canvas.width, canvas.height / 2);
    canvasCtx.stroke();
  }

  function clearCanvas(canvas: HTMLCanvasElement) {
    const canvasCtx = canvas.getContext("2d");
    if (canvasCtx === null) {
      return;
    }
    canvasCtx.fillStyle = "rgb(200, 200, 200)";
    canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
  }

  const playProcessedAudioButton = document.querySelector("#playProcessedAudio");
  if (playProcessedAudioButton !== null) {
    playProcessedAudioButton.addEventListener("click", playProcessedAudio);
  }
  const playOriginalAudioButton = document.querySelector("#playOriginalAudio");
  if (playOriginalAudioButton !== null) {
    playOriginalAudioButton.addEventListener("click", playOriginalAudio);
  }
  const stopAudioButton = document.querySelector("#stopAudio");
  if (stopAudioButton !== null) {
    stopAudioButton.addEventListener("click", stopAudio);
  }

  const originalCanvas = document.querySelector<HTMLCanvasElement>("#oscilloscopeOriginal");
  if (originalCanvas !== null) {
    clearCanvas(originalCanvas);
  }
  const processedCanvas = document.querySelector<HTMLCanvasElement>("#oscilloscopeProcessed");
  if (processedCanvas !== null) {
    clearCanvas(processedCanvas);
  }
});
