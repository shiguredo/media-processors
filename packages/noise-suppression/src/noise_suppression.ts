import { Rnnoise } from "@shiguredo/rnnoise-wasm";

interface NoiseSuppressionProcessorOptions {
  assetsPath?: string;
}

class NoiseSuppressionProcessor {
  private rnnoise?: Rnnoise;
  private track: MediaStreamAudioTrack;
  private abortController?: AbortController;
  private options: NoiseSuppressionProcessorOptions;
  private buffer: Float32Array;
  private bufferFrameCount: number;
  private nextTimestamp: number;

  constructor(track: MediaStreamAudioTrack, options: NoiseSuppressionProcessorOptions = {}) {
    this.track = track;
    this.options = options;
    this.buffer = new Float32Array(0); // NOTE: `this.rnnoise`初期化後に正式なサイズで割り当てが行われる
    this.bufferFrameCount = 0;
    this.nextTimestamp = 0;
  }

  static isSupported(): boolean {
    return !(typeof MediaStreamTrackProcessor === "undefined" || typeof MediaStreamTrackGenerator === "undefined");
  }

  async startProcessing(): Promise<MediaStreamTrack> {
    if (this.rnnoise !== undefined) {
      throw Error("NoiseSuppressionProcessor has already been started.");
    }

    this.rnnoise = await Rnnoise.load({ assetsPath: this.options.assetsPath });
    this.buffer = new Float32Array(this.rnnoise.frameSize);

    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    const generator = new MediaStreamTrackGenerator({ kind: "audio" });
    const processor = new MediaStreamTrackProcessor({ track: this.track });
    processor.readable
      .pipeThrough(
        new TransformStream({
          transform: (frame, controller) => {
            // eslint-disable-next-line  @typescript-eslint/no-unsafe-argument
            this.transform(frame, controller);
          },
        }),
        { signal }
      )
      .pipeTo(generator.writable)
      .catch((e) => {
        if (signal.aborted) {
          console.log("Shutting down streams after abort.");
        } else {
          console.warn("Error from stream transform:", e);
        }
        processor.readable.cancel(e).catch((e) => {
          console.warn("Failed to cancel `MediaStreamTrackProcessor`:", e);
        });
        generator.writable.abort(e).catch((e) => {
          console.warn("Failed to abort `MediaStreamTrackGenerator`:", e);
        });
      });
    return Promise.resolve(generator);
  }

  stopProcessing() {
    if (this.abortController !== undefined) {
      this.abortController.abort();
      this.abortController = undefined;
      this.rnnoise = undefined;
    }
  }

  private transform(data: AudioData, controller: TransformStreamDefaultController<AudioData>): void {
    if (this.rnnoise === undefined) {
      throw Error("NoiseSuppressionProcessor already has been stopped.");
    }
    if (data.numberOfChannels !== 1) {
      throw Error("Noise suppression for stereo channel has not been supported yet.");
    }
    if (data.format !== "f32-planar") {
      // https://www.w3.org/TR/webcodecs/#audio-buffer-arrangement を見ると、
      // "The Web Audio API currently uses f32-planar exclusively"と書いてあるので、
      // いったんは"f32-planar"のみに対応（必要に応じて実装を追加していく）。
      //
      // MEMO: `AutoData.copyTo`で`format`が指定できるので、もしかしたら
      //       そのオプションで"f32-planar"を指定しておけば、後続の処理は共通化できるかもしれない。
      throw Error(`Unsupported audio data format ${data.format}."`);
    }

    if (this.bufferFrameCount == 0) {
      this.nextTimestamp = data.timestamp;
    }

    let frameOffset = 0;
    while (frameOffset < data.numberOfFrames) {
      const frameCount = Math.min(this.rnnoise.frameSize - this.bufferFrameCount, data.numberOfFrames - frameOffset);
      data.copyTo(this.buffer.subarray(this.bufferFrameCount), { planeIndex: 0, frameOffset, frameCount });
      this.bufferFrameCount += frameCount;
      frameOffset += frameCount;

      if (this.bufferFrameCount == this.rnnoise.frameSize) {
        // RNNoiseが16-bit PCMを仮定しているので変換
        for (const [i, value] of this.buffer.entries()) {
          this.buffer[i] = value * 0x7fff;
        }

        // ノイズ低減処理
        this.rnnoise.processFrame(this.buffer);

        // f32-planarに戻す
        for (const [i, value] of this.buffer.entries()) {
          this.buffer[i] = value / 0x7fff;
        }

        controller.enqueue(
          new AudioData({
            format: data.format,
            sampleRate: data.sampleRate,
            numberOfFrames: this.rnnoise.frameSize,
            numberOfChannels: data.numberOfChannels,
            timestamp: this.nextTimestamp,
            data: this.buffer,
          })
        );
        this.buffer = new Float32Array(this.rnnoise.frameSize);
        this.bufferFrameCount = 0;
        this.nextTimestamp = data.timestamp + (data.duration * frameOffset) / data.numberOfFrames;
      }
    }

    data.close();
  }
}

export { NoiseSuppressionProcessor, NoiseSuppressionProcessorOptions };
