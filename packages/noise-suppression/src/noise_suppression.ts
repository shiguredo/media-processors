import { DenoiseState, Rnnoise } from "@shiguredo/rnnoise-wasm";

/**
 * 音声トラックにノイズ抑制処理を適用するためのプロセッサ
 */
class NoiseSuppressionProcessor {
  private assetsPath: string;
  private rnnoise?: Rnnoise;
  private trackProcessor?: TrackProcessor;

  /**
   * {@link NoiseSuppressionProcessor}インスタンスを生成します
   *
   * @param assetsPath wasm ファイルの配置先ディレクトリパスないしURL
   */
  constructor(assetsPath: string) {
    this.assetsPath = trimLastSlash(assetsPath);
  }

  /**
   * 実行環境が必要な機能をサポートしているかどうかを判定します
   *
   * "MediaStreamTrack Insertable Streams"が利用可能である必要があります
   *
   * @returns サポートされているかどうか
   */
  static isSupported(): boolean {
    return !(typeof MediaStreamTrackProcessor === "undefined" || typeof MediaStreamTrackGenerator === "undefined");
  }

  /**
   * ノイズ抑制処理の適用を開始します
   *
   * @param track 処理適用対象となる音声トラック
   * @returns 処理適用後の音声トラック
   *
   * @remarks
   * ノイズ抑制用に利用しているRNNoiseというライブラリが、音声フォーマットとして、
   * サンプリングレートに48kHz、一フレーム辺りのサンプル数に480を想定しているため、
   * 可能であれば、入力音声をこのフォーマットに合わせて設定することを推奨します。
   *
   * また、現時点ではモノラルのみの対応となっており、複数チャンネルを含む音声トラックの場合には、
   * 実行時にエラーが送出されます。

   */
  async startProcessing(track: MediaStreamAudioTrack): Promise<MediaStreamTrack> {
    if (this.isProcessing()) {
      throw Error("Noise suppression processing has already started.");
    }

    if (this.rnnoise === undefined) {
      this.rnnoise = await Rnnoise.load({ assetsPath: this.assetsPath });
    }

    this.trackProcessor = new TrackProcessor(track, this.rnnoise);
    return this.trackProcessor.startProcessing();
  }

  /**
   * ノイズ抑制処理の適用を停止します
   *
   * コンストラクタに渡された音声トラックは閉じないので、
   * 必要であれば、別途呼び出し側で対処する必要があります
   */
  stopProcessing() {
    // NOTE: コンパイラの警告を防ぐために isProcessing は使わずに判定している
    if (this.trackProcessor !== undefined) {
      this.trackProcessor.stopProcessing();
      this.trackProcessor = undefined;
    }
  }

  /**
   * ノイズ抑制処理が実行中かどうかを判定します
   *
   * @returns 実行中であれば `true` 、そうでなければ `false`
   */
  isProcessing(): boolean {
    return this.trackProcessor !== undefined;
  }
}

class TrackProcessor {
  private track: MediaStreamAudioTrack;
  private abortController: AbortController;
  private denoiseState: DenoiseState;
  private buffer: Float32Array;
  private frameSize: number;
  private bufferFrameCount: number;
  private nextTimestamp: number;

  constructor(track: MediaStreamAudioTrack, rnnoise: Rnnoise) {
    this.track = track;
    this.denoiseState = rnnoise.createDenoiseState();
    this.buffer = new Float32Array(rnnoise.frameSize);
    this.frameSize = rnnoise.frameSize;
    this.bufferFrameCount = 0;
    this.nextTimestamp = 0;
    this.abortController = new AbortController();
  }

  startProcessing(): Promise<MediaStreamTrack> {
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
          console.debug("Shutting down streams after abort.");
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
    this.abortController.abort();
    this.denoiseState.destroy();
  }

  private transform(data: AudioData, controller: TransformStreamDefaultController<AudioData>): void {
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
      const frameCount = Math.min(this.frameSize - this.bufferFrameCount, data.numberOfFrames - frameOffset);
      data.copyTo(this.buffer.subarray(this.bufferFrameCount), { planeIndex: 0, frameOffset, frameCount });
      this.bufferFrameCount += frameCount;
      frameOffset += frameCount;

      if (this.bufferFrameCount == this.frameSize) {
        // RNNoiseが16-bit PCMを仮定しているので変換
        for (const [i, value] of this.buffer.entries()) {
          this.buffer[i] = value * 0x7fff;
        }

        // ノイズ低減処理
        this.denoiseState.processFrame(this.buffer);

        // f32-planarに戻す
        for (const [i, value] of this.buffer.entries()) {
          this.buffer[i] = value / 0x7fff;
        }

        controller.enqueue(
          new AudioData({
            format: data.format,
            sampleRate: data.sampleRate,
            numberOfFrames: this.frameSize,
            numberOfChannels: data.numberOfChannels,
            timestamp: this.nextTimestamp,
            data: this.buffer,
          })
        );
        this.buffer = new Float32Array(this.frameSize);
        this.bufferFrameCount = 0;
        this.nextTimestamp = data.timestamp + (data.duration * frameOffset) / data.numberOfFrames;
      }
    }

    data.close();
  }
}

function trimLastSlash(s: string): string {
  if (s.slice(-1) === "/") {
    return s.slice(0, -1);
  }
  return s;
}

export { NoiseSuppressionProcessor };
