import { Rnnoise } from "@shiguredo/rnnoise-wasm";

/**
 * {@link NoiseSuppressionProcessor} に指定可能なオプション
 */
interface NoiseSuppressionProcessorOptions {
  /**
   * wasm ファイルの配置先ディレクトリパスないしURL
   *
   * デフォルトでは、カレントディレクトリが使用されます
   */
  assetsPath?: string;
}

/**
 * 音声トラックにノイズ抑制処理を適用するためのプロセッサ
 */
class NoiseSuppressionProcessor {
  private rnnoise?: Rnnoise;
  private track: MediaStreamAudioTrack;
  private abortController?: AbortController;
  private options: NoiseSuppressionProcessorOptions;
  private buffer: Float32Array;
  private bufferFrameCount: number;
  private nextTimestamp: number;

  /**
   * {@link NoiseSuppressionProcessor}インスタンスを生成します
   *
   * {@link NoiseSuppressionProcessor.startProcessing}メソッドが呼び出されるまでは、
   * ノイズ抑制処理は適用されません
   *
   * @param track 処理適用対象となる音声トラック
   * @param options 各種オプション
   *
   * @remarks
   * ノイズ抑制用に利用しているRNNoiseというライブラリが、音声フォーマットとして、
   * サンプリングレートに48kHz、一フレーム辺りのサンプル数に480を想定しているため、
   * 可能であれば、入力音声をこのフォーマットに合わせて設定することを推奨します。
   *
   * また、現時点ではモノラルのみの対応となっており、複数チャンネルを含む音声トラックの場合には、
   * 実行時にエラーが送出されます。
   */
  constructor(track: MediaStreamAudioTrack, options: NoiseSuppressionProcessorOptions = {}) {
    this.track = track;
    this.options = options;
    this.buffer = new Float32Array(0); // NOTE: `this.rnnoise`初期化後に正式なサイズで割り当てが行われる
    this.bufferFrameCount = 0;
    this.nextTimestamp = 0;
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
   * @returns 処理適用後の音声トラック
   */
  async startProcessing(): Promise<MediaStreamTrack> {
    if (this.rnnoise !== undefined) {
      throw Error("NoiseSuppressionProcessor has already been started.");
    }

    const assetsPath = trimLastSlash(this.options.assetsPath || ".");
    this.rnnoise = await Rnnoise.load({ assetsPath });
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

  /**
   * ノイズ抑制処理の適用を停止します
   *
   * コンストラクタに渡された音声トラックは閉じないので、
   * 必要であれば、別途呼び出し側で対処する必要があります
   */
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

function trimLastSlash(s: string): string {
  if (s[s.length - 1] == "/") {
    return s.slice(0, -1);
  } else {
    return s;
  }
}

export { NoiseSuppressionProcessor, NoiseSuppressionProcessorOptions };
