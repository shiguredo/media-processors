import { DenoiseState, Rnnoise } from '@shiguredo/rnnoise-wasm'

/**
 * {@link NoiseSuppressionProcessor.startProcessing} メソッドに指定可能なオプション
 */
interface NoiseSuppressionProcessorOptions {
  /**
   * 使用する RNNoise のモデルのパスないし URL
   *
   * 省略された場合は、デフォルトモデルが使用されます
   */
  modelPath?: string
}

/**
 * 音声トラックにノイズ抑制処理を適用するためのプロセッサ
 */
class NoiseSuppressionProcessor {
  private assetsPath: string
  private rnnoise?: Rnnoise
  private trackProcessor?: TrackProcessor
  private processedTrack?: MediaStreamAudioTrack
  private originalTrack?: MediaStreamAudioTrack

  /**
   * {@link NoiseSuppressionProcessor}インスタンスを生成します
   *
   * @param assetsPath wasm ファイルの配置先ディレクトリパスないしURL
   */
  constructor(assetsPath: string) {
    this.assetsPath = trimLastSlash(assetsPath)
  }

  /**
   * 実行環境が必要な機能をサポートしているかどうかを判定します
   *
   * "MediaStreamTrack Insertable Streams"が利用可能である必要があります
   *
   * @returns サポートされているかどうか
   */
  static isSupported(): boolean {
    return !(
      typeof MediaStreamTrackProcessor === 'undefined' ||
      typeof MediaStreamTrackGenerator === 'undefined'
    )
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
  async startProcessing(
    track: MediaStreamAudioTrack,
    options: NoiseSuppressionProcessorOptions = {},
  ): Promise<MediaStreamAudioTrack> {
    if (this.isProcessing()) {
      throw Error('Noise suppression processing has already started.')
    }

    if (this.rnnoise === undefined) {
      // 最初の `startProcessing` 呼び出し時に RNNoise をロードする
      this.rnnoise = await Rnnoise.load({ assetsPath: this.assetsPath })
    }

    let denoiseState
    if (options.modelPath === undefined) {
      denoiseState = this.rnnoise.createDenoiseState()
    } else {
      const modelString = await fetch(options.modelPath).then((res) => res.text())
      const model = this.rnnoise.createModel(modelString)
      denoiseState = this.rnnoise.createDenoiseState(model)
    }

    this.trackProcessor = new TrackProcessor(track, this.rnnoise, denoiseState)
    this.originalTrack = track
    this.processedTrack = this.trackProcessor.startProcessing()
    return this.processedTrack
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
      this.trackProcessor.stopProcessing()
      this.trackProcessor = undefined
      this.originalTrack = undefined
      this.processedTrack = undefined
    }
  }

  /**
   * ノイズ抑制処理が実行中かどうかを判定します
   *
   * @returns 実行中であれば `true` 、そうでなければ `false`
   */
  isProcessing(): boolean {
    return this.trackProcessor !== undefined
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
  getOriginalTrack(): MediaStreamAudioTrack | undefined {
    return this.originalTrack
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
  getProcessedTrack(): MediaStreamAudioTrack | undefined {
    return this.processedTrack
  }
}

class TrackProcessor {
  private track: MediaStreamAudioTrack
  private abortController: AbortController
  private denoiseState: DenoiseState
  private buffer: Float32Array
  private frameSize: number
  private bufferFrameCount: number
  private nextTimestamp: number
  private generator: MediaStreamAudioTrackGenerator
  private processor: MediaStreamTrackProcessor<AudioData>

  constructor(track: MediaStreamAudioTrack, rnnoise: Rnnoise, denoiseState: DenoiseState) {
    this.track = track
    this.buffer = new Float32Array(rnnoise.frameSize)
    this.frameSize = rnnoise.frameSize
    this.bufferFrameCount = 0
    this.nextTimestamp = 0
    this.abortController = new AbortController()
    this.denoiseState = denoiseState

    // generator / processor インスタンスを生成（まだ処理は開始しない）
    this.generator = new MediaStreamTrackGenerator({ kind: 'audio' })
    this.processor = new MediaStreamTrackProcessor({ track: this.track })
  }

  startProcessing(): MediaStreamAudioTrack {
    const signal = this.abortController.signal
    this.processor.readable
      .pipeThrough(
        new TransformStream({
          transform: (frame, controller) => {
            // eslint-disable-next-line  @typescript-eslint/no-unsafe-argument
            this.transform(frame, controller)
          },
        }),
        { signal },
      )
      .pipeTo(this.generator.writable)
      .catch((e) => {
        if (signal.aborted) {
          console.debug('Shutting down streams after abort.')
        } else {
          console.warn('Error from stream transform:', e)
        }
        this.processor.readable.cancel(e).catch((e) => {
          console.warn('Failed to cancel `MediaStreamTrackProcessor`:', e)
        })
        this.generator.writable.abort(e).catch((e) => {
          console.warn('Failed to abort `MediaStreamTrackGenerator`:', e)
        })
      })
    return this.generator
  }

  stopProcessing() {
    this.abortController.abort()
    this.denoiseState.destroy()
    if (this.denoiseState.model !== undefined) {
      this.denoiseState.model.free()
    }
  }

  private transform(
    data: AudioData,
    controller: TransformStreamDefaultController<AudioData>,
  ): void {
    if (data.numberOfChannels !== 1) {
      throw Error('Noise suppression for stereo channel has not been supported yet.')
    }
    if (data.format !== 'f32-planar') {
      // https://www.w3.org/TR/webcodecs/#audio-buffer-arrangement を見ると、
      // "The Web Audio API currently uses f32-planar exclusively"と書いてあるので、
      // いったんは"f32-planar"のみに対応（必要に応じて実装を追加していく）。
      //
      // MEMO: `AutoData.copyTo`で`format`が指定できるので、もしかしたら
      //       そのオプションで"f32-planar"を指定しておけば、後続の処理は共通化できるかもしれない。
      throw Error(`Unsupported audio data format ${data.format}."`)
    }

    if (this.bufferFrameCount == 0) {
      this.nextTimestamp = data.timestamp
    }

    let frameOffset = 0
    while (frameOffset < data.numberOfFrames) {
      const frameCount = Math.min(
        this.frameSize - this.bufferFrameCount,
        data.numberOfFrames - frameOffset,
      )
      data.copyTo(this.buffer.subarray(this.bufferFrameCount), {
        planeIndex: 0,
        frameOffset,
        frameCount,
      })
      this.bufferFrameCount += frameCount
      frameOffset += frameCount

      if (this.bufferFrameCount == this.frameSize) {
        // RNNoiseが16-bit PCMを仮定しているので変換
        for (const [i, value] of this.buffer.entries()) {
          this.buffer[i] = value * 0x7fff
        }

        // ノイズ低減処理
        this.denoiseState.processFrame(this.buffer)

        // f32-planarに戻す
        for (const [i, value] of this.buffer.entries()) {
          this.buffer[i] = value / 0x7fff
        }

        if (this.generator.readyState === 'ended') {
          // ジェネレータ（ユーザに渡している処理結果トラック）がクローズ済み。
          // この状態で `controller.enqueue()` を呼び出すとエラーが発生するのでスキップする。
          // また `stopProcessing()` を呼び出して変換処理を停止し、以後は `transform()` 自体が呼ばれないようにする。
          //
          // なお、上の条件判定と下のエンキューの間でジェネレータの状態が変わり、エラーが発生する可能性もないとは
          // 言い切れないが、かなりレアケースだと想定され、そこまでケアするのはコスパが悪いので諦めることとする。
          this.stopProcessing()
          break
        }

        controller.enqueue(
          new AudioData({
            format: data.format,
            sampleRate: data.sampleRate,
            numberOfFrames: this.frameSize,
            numberOfChannels: data.numberOfChannels,
            timestamp: this.nextTimestamp,
            data: this.buffer,
          }),
        )
        this.buffer = new Float32Array(this.frameSize)
        this.bufferFrameCount = 0
        this.nextTimestamp = data.timestamp + (data.duration * frameOffset) / data.numberOfFrames
      }
    }

    data.close()
  }
}

function trimLastSlash(s: string): string {
  if (s.slice(-1) === '/') {
    return s.slice(0, -1)
  }
  return s
}

export { NoiseSuppressionProcessor, NoiseSuppressionProcessorOptions }
