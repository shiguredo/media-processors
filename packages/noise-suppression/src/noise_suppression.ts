import { Rnnoise } from "@shiguredo/rnnoise-wasm";
import type { DenoiseState } from "@shiguredo/rnnoise-wasm";

/**
 * 音声トラックにノイズ抑制処理を適用するためのプロセッサ
 */
class NoiseSuppressionProcessor {
  private rnnoise?: Rnnoise;
  private trackProcessor?: TrackProcessor;
  private processedTrack?: MediaStreamAudioTrack;
  private originalTrack?: MediaStreamAudioTrack;

  /**
   * 実行環境が必要な機能をサポートしているかどうかを判定します
   *
   * "MediaStreamTrack Insertable Streams"が利用可能である必要があります
   *
   * @returns サポートされているかどうか
   */
  static isSupported(): boolean {
    return !(
      typeof MediaStreamTrackProcessor === "undefined" ||
      typeof MediaStreamTrackGenerator === "undefined"
    );
  }

  /**
   * ノイズ抑制処理の適用を開始します
   *
   * @param track 処理適用対象となる音声トラック
   * @param options 各種オプション
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
  async startProcessing(track: MediaStreamAudioTrack): Promise<MediaStreamAudioTrack> {
    if (this.isProcessing()) {
      throw new Error("Noise suppression processing has already started.");
    }

    // 最初の `startProcessing` 呼び出し時に RNNoise をロードする
    this.rnnoise ??= await Rnnoise.load();

    const denoiseState = this.rnnoise.createDenoiseState();

    this.trackProcessor = new TrackProcessor(track, this.rnnoise, denoiseState);
    this.originalTrack = track;
    this.processedTrack = this.trackProcessor.startProcessing();
    return this.processedTrack;
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
      this.originalTrack = undefined;
      this.processedTrack = undefined;
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

  /**
   * 処理適用前の音声トラックを返します
   *
   * これは {@link NoiseSuppressionProcessor.startProcessing} に渡したトラックと等しいです
   *
   * {@link NoiseSuppressionProcessor.startProcessing} 呼び出し前、あるいは、
   * {@link NoiseSuppressionProcessor.stopProcessing} 呼び出し後には `undefined` が返されます
   *
   * @returns 処理適用中の場合は音声トラック、それ以外なら `undefined`
   */
  // oxlint-disable-next-line typescript-eslint/no-redundant-type-constituents -- oxlint が @types/dom-mediacapture-transform のグローバル型を解決できないための偽陽性
  getOriginalTrack(): MediaStreamAudioTrack | undefined {
    return this.originalTrack;
  }

  /**
   * 処理適用後の音声トラックを返します
   *
   * これは {@link NoiseSuppressionProcessor.startProcessing} が返したトラックと等しいです
   *
   * {@link NoiseSuppressionProcessor.startProcessing} 呼び出し前、あるいは、
   * {@link NoiseSuppressionProcessor.stopProcessing} 呼び出し後には `undefined` が返されます
   *
   * @returns 処理適用中の場合は音声トラック、それ以外なら `undefined`
   */
  // oxlint-disable-next-line typescript-eslint/no-redundant-type-constituents -- oxlint が @types/dom-mediacapture-transform のグローバル型を解決できないための偽陽性
  getProcessedTrack(): MediaStreamAudioTrack | undefined {
    return this.processedTrack;
  }
}

class TrackProcessor {
  private readonly track: MediaStreamAudioTrack;
  private readonly abortController: AbortController;
  private readonly denoiseState: DenoiseState;
  // AudioData の data には ArrayBuffer 固定の Float32Array が必要なので型を絞る
  private buffer: Float32Array<ArrayBuffer>;
  private readonly frameSize: number;
  private bufferFrameCount: number;
  private nextTimestamp: number;
  private readonly generator: MediaStreamAudioTrackGenerator;
  private readonly processor: MediaStreamTrackProcessor<AudioData>;

  constructor(track: MediaStreamAudioTrack, rnnoise: Rnnoise, denoiseState: DenoiseState) {
    this.track = track;
    this.buffer = new Float32Array(rnnoise.frameSize) as Float32Array<ArrayBuffer>;
    this.frameSize = rnnoise.frameSize;
    this.bufferFrameCount = 0;
    this.nextTimestamp = 0;
    this.abortController = new AbortController();
    this.denoiseState = denoiseState;

    // Generator / processor インスタンスを生成（まだ処理は開始しない）
    this.generator = new MediaStreamTrackGenerator({ kind: "audio" });
    this.processor = new MediaStreamTrackProcessor({ track: this.track });
  }

  startProcessing(): MediaStreamAudioTrack {
    const { signal } = this.abortController;
    // oxlint-disable-next-line typescript-eslint/no-unsafe-member-access -- oxlint が @types/dom-mediacapture-transform のグローバル型を解決できないための偽陽性
    this.processor.readable
      .pipeThrough(
        new TransformStream({
          transform: (frame, controller) => {
            this.transform(frame, controller);
          },
        }),
        { signal },
      )
      // oxlint-disable-next-line typescript-eslint/no-unsafe-member-access -- oxlint が @types/dom-mediacapture-transform のグローバル型を解決できないための偽陽性
      .pipeTo(this.generator.writable)
      // oxlint-disable-next-line typescript-eslint/no-unsafe-member-access -- oxlint が @types/dom-mediacapture-transform のグローバル型を解決できないための偽陽性
      .catch((error) => {
        if (signal.aborted) {
          console.debug("Shutting down streams after abort.");
        } else {
          console.warn("Error from stream transform:", error);
        }
        // oxlint-disable-next-line typescript-eslint/no-unsafe-member-access -- oxlint が @types/dom-mediacapture-transform のグローバル型を解決できないための偽陽性
        this.processor.readable.cancel(error).catch((error) => {
          console.warn("Failed to cancel `MediaStreamTrackProcessor`:", error);
        });
        // oxlint-disable-next-line typescript-eslint/no-unsafe-member-access -- oxlint が @types/dom-mediacapture-transform のグローバル型を解決できないための偽陽性
        this.generator.writable.abort(error).catch((error) => {
          console.warn("Failed to abort `MediaStreamTrackGenerator`:", error);
        });
      });
    return this.generator;
  }

  stopProcessing() {
    this.abortController.abort();
    this.denoiseState.destroy();
  }

  private transform(
    data: AudioData,
    controller: TransformStreamDefaultController<AudioData>,
  ): void {
    if (data.numberOfChannels !== 1) {
      throw new Error("Noise suppression for stereo channel has not been supported yet.");
    }
    if (data.format !== "f32-planar") {
      // https://www.w3.org/TR/webcodecs/#audio-buffer-arrangement を見ると、
      // "The Web Audio API currently uses f32-planar exclusively"と書いてあるので、
      // いったんは"f32-planar"のみに対応（必要に応じて実装を追加していく）。
      //
      // MEMO: `AutoData.copyTo`で`format`が指定できるので、もしかしたら
      //       そのオプションで"f32-planar"を指定しておけば、後続の処理は共通化できるかもしれない。
      throw new Error(`Unsupported audio data format ${data.format}."`);
    }

    if (this.bufferFrameCount === 0) {
      this.nextTimestamp = data.timestamp;
    }

    let frameOffset = 0;
    while (frameOffset < data.numberOfFrames) {
      const frameCount = Math.min(
        this.frameSize - this.bufferFrameCount,
        data.numberOfFrames - frameOffset,
      );
      data.copyTo(this.buffer.subarray(this.bufferFrameCount), {
        frameCount,
        frameOffset,
        planeIndex: 0,
      });
      this.bufferFrameCount += frameCount;
      frameOffset += frameCount;

      if (this.bufferFrameCount === this.frameSize) {
        // RNNoiseが16-bit PCMを仮定しているので変換
        for (const [i, value] of this.buffer.entries()) {
          this.buffer[i] = value * 0x7f_ff;
        }

        // ノイズ低減処理
        this.denoiseState.processFrame(this.buffer);

        // F32-planarに戻す
        for (const [i, value] of this.buffer.entries()) {
          this.buffer[i] = value / 0x7f_ff;
        }

        // oxlint-disable-next-line typescript-eslint/no-unsafe-member-access -- oxlint が @types/dom-mediacapture-transform のグローバル型を解決できないための偽陽性
        if (this.generator.readyState === "ended") {
          // ジェネレータ（ユーザに渡している処理結果トラック）がクローズ済み。
          // この状態で `controller.enqueue()` を呼び出すとエラーが発生するのでスキップする。
          // また `stopProcessing()` を呼び出して変換処理を停止し、以後は `transform()` 自体が呼ばれないようにする。
          //
          // なお、上の条件判定と下のエンキューの間でジェネレータの状態が変わり、エラーが発生する可能性もないとは
          // 言い切れないが、かなりレアケースだと想定され、そこまでケアするのはコスパが悪いので諦めることとする。
          this.stopProcessing();
          break;
        }

        controller.enqueue(
          new AudioData({
            data: this.buffer,
            format: data.format,
            numberOfChannels: data.numberOfChannels,
            numberOfFrames: this.frameSize,
            sampleRate: data.sampleRate,
            timestamp: this.nextTimestamp,
          }),
        );
        this.buffer = new Float32Array(this.frameSize) as Float32Array<ArrayBuffer>;
        this.bufferFrameCount = 0;
        this.nextTimestamp = data.timestamp + (data.duration * frameOffset) / data.numberOfFrames;
      }
    }

    data.close();
  }
}

export { NoiseSuppressionProcessor };
