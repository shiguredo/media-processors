const WASM_BASE64 = '__WASM__'

// biome-ignore lint/style/noUnusedTemplateLiteral: audio_processor.js 内で文字列を扱いたいので `` で囲んでいる
const AUDIO_WORKLET_PROCESSOR_CODE = `__AUDIO_PROCESSOR__`
const AUDIO_WORKLET_PROCESSOR_NAME = 'mp4-media-stream-audio-worklet-processor'

/**
 * {@link Mp4MediaStream.play} に指定可能なオプション
 */
interface PlayOptions {
  /**
   * true が指定されると、MP4 ファイルの終端に達した場合に、先頭に戻って再生が繰り返されます
   *
   * デフォルト値は false
   */
  repeat?: boolean
}

const AUDIO_DECODER_ID: number = 0
const VIDEO_DECODER_ID: number = 1

/**
 * MP4 を入力にとって、それを再生する MediaStream を生成するクラス
 */
class Mp4MediaStream {
  private wasm: WebAssembly.Instance
  private memory: WebAssembly.Memory
  private engine: number
  private info?: Mp4Info
  private players: Map<number, Player> = new Map()
  private nextPlayerId = 0

  private constructor(wasm: WebAssembly.Instance) {
    this.wasm = wasm
    this.memory = wasm.exports.memory as WebAssembly.Memory
    this.engine = (this.wasm.exports.newEngine as CallableFunction)()
  }

  /**
   * 実行環境が必要な機能をサポートしているかどうかを判定します
   *
   * 以下のクラスが利用可能である必要があります:
   * - AudioDecoder
   * - VideoDecoder
   *
   * @returns サポートされているかどうか
   */
  static isSupported(): boolean {
    return typeof AudioDecoder !== 'undefined' && typeof VideoDecoder !== 'undefined'
  }

  /**
   * 指定された MP4 をロードします
   *
   * @param mp4 対象の MP4 データ
   *
   * @returns ロード結果の Mp4MediaStream インスタンス
   *
   * @throws
   * 指定された MP4 が不正であったり、非対応コーデックを含んでいる場合には例外が送出されます
   */
  static async load(mp4: Blob): Promise<Mp4MediaStream> {
    // インポート関数の中で this を参照したいけど、この時点ではまだ作成されていないので
    // 間接的に参照するようにする
    const ref: { stream?: Mp4MediaStream } = { stream: undefined }
    const importObject = {
      env: {
        now() {
          return performance.now()
        },
        consoleLog(messageWasmJson: number) {
          if (ref.stream) {
            ref.stream.consoleLog(messageWasmJson)
          }
        },
        sleep(resultTx: number, duration: number) {
          if (ref.stream) {
            ref.stream.sleep(resultTx, duration)
          }
        },
        createVideoDecoder(resultTx: number, playerId: number, configWasmJson: number) {
          if (ref.stream) {
            ref.stream.createVideoDecoder(resultTx, playerId, configWasmJson)
          }
        },
        createAudioDecoder(resultTx: number, playerId: number, configWasmJson: number) {
          if (ref.stream) {
            ref.stream.createAudioDecoder(resultTx, playerId, configWasmJson)
          }
        },
        closeDecoder(playerId: number, decoderId: number) {
          if (ref.stream) {
            ref.stream.closeDecoder(playerId, decoderId)
          }
        },
        decode(
          playerId: number,
          decoderId: number,
          metadataWasmJson: number,
          dataOffset: number,
          dataLen: number,
        ) {
          if (ref.stream) {
            ref.stream.decode(playerId, decoderId, metadataWasmJson, dataOffset, dataLen)
          }
        },
        onEos(playerId: number) {
          if (ref.stream) {
            ref.stream.onEos(playerId)
          }
        },
      },
    }
    const wasmResults = await WebAssembly.instantiateStreaming(
      fetch(`data:application/wasm;base64,${WASM_BASE64}`),
      importObject,
    )

    const stream = new Mp4MediaStream(wasmResults.instance)
    ref.stream = stream

    const mp4Bytes = new Uint8Array(await mp4.arrayBuffer())
    await stream.loadMp4(mp4Bytes)

    return stream
  }

  /**
   * ロード済み MP4 の再生するための MediaStream インスタンスを生成します
   *
   * @param options 再生オプション
   *
   * @returns MP4 再生用の MediaStream インスタンス
   *
   * 複数回呼び出された場合には、それぞれが別々の MediaStream インスタンスを返します
   *
   * [注意]
   * 返り値の MediaStream は RTCPeerConnection に渡して WebRTC のソースとすることも可能です。
   * ただし、その場合には「同時に VideoElement.srcObject に指定する」などのように別に経路でも参照される
   * ようにしないと、WebRTC の受信側で映像のフレームレートが極端に下がったり、止まったりする現象が確認されています。
   * なお、VideoElement はミュートかつ hidden visibility でも問題ありません。
   */
  play(options: PlayOptions = {}): Promise<MediaStream> {
    if (this.info === undefined) {
      // ここには来ないはず
      throw new Error('bug')
    }

    const playerId = this.nextPlayerId
    this.nextPlayerId += 1

    const player = new Player(this.info.audioConfigs, this.info.videoConfigs)
    this.players.set(playerId, player)
    ;(this.wasm.exports.play as CallableFunction)(
      this.engine,
      playerId,
      this.valueToWasmJson(options),
    )

    return player.createMediaStream()
  }

  /**
   * 再生中の全ての MediaStream を停止します
   *
   * 個別の MediaStream を停止したい場合には、単にそのインスタンスを破棄するか、
   * MedisStreamTrack.stop() を呼び出してください
   */
  async stop() {
    for (const playerId of this.players.keys()) {
      await this.stopPlayer(playerId)
    }
  }

  private async stopPlayer(playerId: number) {
    const player = this.players.get(playerId)
    if (player === undefined) {
      return
    }
    ;(this.wasm.exports.stop as CallableFunction)(this.engine, playerId)
    await player.stop()

    this.players.delete(playerId)
  }

  private async loadMp4(mp4Bytes: Uint8Array): Promise<{ audio: boolean; video: boolean }> {
    const mp4WasmBytes = this.toWasmBytes(mp4Bytes)
    const resultWasmJson = (this.wasm.exports.loadMp4 as CallableFunction)(
      this.engine,
      mp4WasmBytes,
    )

    // MP4 内に含まれる映像・音声を WebCodecs のデコーダー扱えるかどうかをチェックする
    const info = this.wasmResultToValue(resultWasmJson) as Mp4Info
    for (const config of info.audioConfigs) {
      if (!(await AudioDecoder.isConfigSupported(config)).supported) {
        throw new Error(`Unsupported audio decoder configuration: ${JSON.stringify(config)}`)
      }
    }
    for (const config of info.videoConfigs) {
      // JSON.parse() の結果では config.description の型は number[] となって期待とは異なるので
      // ここで適切な型に変換している
      config.description = new Uint8Array(config.description as object as number[])

      if (!(await VideoDecoder.isConfigSupported(config)).supported) {
        throw new Error(`Unsupported video decoder configuration: ${JSON.stringify(config)}`)
      }
    }
    this.info = info

    return { audio: info.audioConfigs.length > 0, video: info.videoConfigs.length > 0 }
  }

  private consoleLog(messageWasmJson: number) {
    const message = this.wasmJsonToValue(messageWasmJson)
    console.log(message)
  }

  private async sleep(resultTx: number, duration: number) {
    setTimeout(() => {
      ;(this.wasm.exports.awake as CallableFunction)(this.engine, resultTx)
    }, duration)
  }

  private async createVideoDecoder(resultTx: number, playerId: number, configWasmJson: number) {
    const player = this.players.get(playerId)
    if (player === undefined) {
      // stop() と競合したらここに来る可能性がある
      // すでに停止済みであり、新規でデコーダーを作成する必要はないので、ここで return する
      return
    }

    // 一つ前のデコーダーの終了処理が進行中の場合に備えて、ここでも close を呼び出して終了を待機する
    await player.closeVideoDecoder()

    const config = this.wasmJsonToValue(configWasmJson) as VideoDecoderConfig

    // JSON.parse() の結果では config.description の型は number[] となって期待とは異なるので
    // ここで適切な型に変換している
    config.description = new Uint8Array(config.description as object as number[])

    const init = {
      output: async (frame: VideoFrame) => {
        if (player.canvas === undefined || player.canvasCtx === undefined) {
          return
        }

        try {
          player.canvas.width = frame.displayWidth
          player.canvas.height = frame.displayHeight
          player.canvasCtx.drawImage(frame, 0, 0)
          frame.close()
        } catch (error) {
          // エラーが発生した場合には再生を停止する
          await this.stopPlayer(playerId)
          throw error
        }
      },
      error: async (error: DOMException) => {
        // デコードエラーが発生した場合には再生を停止する
        await this.stopPlayer(playerId)
        throw error
      },
    }

    player.videoDecoder = new VideoDecoder(init)
    player.videoDecoder.configure(config)
    ;(this.wasm.exports.notifyDecoderId as CallableFunction)(
      this.engine,
      resultTx,
      VIDEO_DECODER_ID,
    )
  }

  private async createAudioDecoder(resultTx: number, playerId: number, configWasmJson: number) {
    const player = this.players.get(playerId)
    if (player === undefined) {
      // stop() と競合したらここに来る可能性がある
      // すでに停止済みであり、新規でデコーダーを作成する必要はないので、ここで return する
      return
    }

    // 一つ前のデコーダーの終了処理が進行中の場合に備えて、ここでも close を呼び出して終了を待機する
    await player.closeAudioDecoder()

    const config = this.wasmJsonToValue(configWasmJson) as AudioDecoderConfig
    const init = {
      output: async (data: AudioData) => {
        if (player.audioInputNode === undefined) {
          return
        }

        try {
          const samples = new Float32Array(data.numberOfFrames * data.numberOfChannels)
          data.copyTo(samples, { planeIndex: 0, format: 'f32' })
          data.close()

          const timestamp = data.timestamp
          player.audioInputNode.port.postMessage({ timestamp, samples }, [samples.buffer])
        } catch (e) {
          // エラーが発生した場合には再生を停止する
          await this.stopPlayer(playerId)
          throw e
        }
      },
      error: async (error: DOMException) => {
        // デコードエラーが発生した場合には再生を停止する
        await this.stopPlayer(playerId)
        throw error
      },
    }

    player.audioDecoder = new AudioDecoder(init)
    player.audioDecoder.configure(config)
    ;(this.wasm.exports.notifyDecoderId as CallableFunction)(
      this.engine,
      resultTx,
      AUDIO_DECODER_ID,
    )
  }

  private async closeDecoder(playerId: number, decoderId: number) {
    const player = this.players.get(playerId)
    if (player === undefined) {
      // すでに停止済みなので、何もする必要はない
      return
    }

    if (decoderId === AUDIO_DECODER_ID) {
      await player.closeAudioDecoder()
    } else {
      await player.closeVideoDecoder()
    }
  }

  // MP4 の終端に達した場合に呼ばれるコールバック
  private async onEos(playerId: number) {
    await this.stopPlayer(playerId)
  }

  private decode(
    playerId: number,
    decoderId: number,
    metadataWasmJson: number,
    dataOffset: number,
    dataLen: number,
  ) {
    const player = this.players.get(playerId)
    if (player === undefined) {
      // stop() 呼び出しと競合した場合にここに来る可能性がある
      // すでに停止済みなので、これ以上デコードを行う必要はない
      return
    }

    const chunkParams = this.wasmJsonToValue(metadataWasmJson) as
      | EncodedAudioChunkInit
      | EncodedVideoChunkInit
    chunkParams.data = new Uint8Array(this.memory.buffer, dataOffset, dataLen)

    if (decoderId === VIDEO_DECODER_ID) {
      if (player.videoDecoder === undefined) {
        // ここには来ないはず
        throw new Error('bug')
      }
      const chunk = new EncodedVideoChunk(chunkParams)
      player.videoDecoder.decode(chunk)
    } else {
      if (player.audioDecoder === undefined) {
        // ここには来ないはず
        throw new Error('bug')
      }
      const chunk = new EncodedAudioChunk(chunkParams)
      player.audioDecoder.decode(chunk)
    }
  }

  private wasmJsonToValue(wasmJson: number): object {
    const offset = (this.wasm.exports.vecOffset as CallableFunction)(wasmJson)
    const len = (this.wasm.exports.vecLen as CallableFunction)(wasmJson)
    const buffer = new Uint8Array(this.memory.buffer, offset, len)
    const value = JSON.parse(new TextDecoder('utf-8').decode(buffer))

    // Wasm 側で所有権は放棄されているので、解放するのは呼び出し側の責務
    ;(this.wasm.exports.freeVec as CallableFunction)(wasmJson)

    return value
  }

  private wasmResultToValue(wasmResult: number): object {
    const result = this.wasmJsonToValue(wasmResult) as { Ok?: object; Err?: { message: string } }
    if (result.Err !== undefined) {
      throw new Error(result.Err.message)
    }
    return result.Ok as object
  }

  private valueToWasmJson(value: object): number {
    const jsonBytes = new TextEncoder().encode(JSON.stringify(value))
    return this.toWasmBytes(jsonBytes)
  }

  private toWasmBytes(bytes: Uint8Array): number {
    // ここで割り当てられたメモリ領域を解放するのは Wasm 側の責務
    const wasmBytes = (this.wasm.exports.allocateVec as CallableFunction)(bytes.length)
    const wasmBytesOffset = (this.wasm.exports.vecOffset as CallableFunction)(wasmBytes)
    new Uint8Array(this.memory.buffer, wasmBytesOffset, bytes.length).set(bytes)
    return wasmBytes
  }
}

type Mp4Info = {
  audioConfigs: [AudioDecoderConfig]
  videoConfigs: [VideoDecoderConfig]
}

class Player {
  private audio: boolean
  private video: boolean
  private numberOfChannels = 1
  private sampleRate = 48000
  audioDecoder?: AudioDecoder
  videoDecoder?: VideoDecoder
  canvas?: HTMLCanvasElement
  canvasCtx?: CanvasRenderingContext2D
  audioContext?: AudioContext
  audioInputNode?: AudioWorkletNode

  constructor(audioConfigs: AudioDecoderConfig[], videoConfigs: VideoDecoderConfig[]) {
    this.audio = audioConfigs.length > 0
    this.video = videoConfigs.length > 0

    if (audioConfigs.length > 0) {
      // [NOTE] 今は複数音声入力トラックには未対応なので、最初の一つに決め打ちでいい
      this.numberOfChannels = audioConfigs[0].numberOfChannels
      this.sampleRate = audioConfigs[0].sampleRate
    }
  }

  async createMediaStream(): Promise<MediaStream> {
    const tracks = []
    if (this.audio) {
      const blob = new Blob([AUDIO_WORKLET_PROCESSOR_CODE], { type: 'application/javascript' })
      this.audioContext = new AudioContext({ sampleRate: this.sampleRate })
      await this.audioContext.audioWorklet.addModule(URL.createObjectURL(blob))

      this.audioInputNode = new AudioWorkletNode(this.audioContext, AUDIO_WORKLET_PROCESSOR_NAME, {
        outputChannelCount: [this.numberOfChannels],
      })

      const destination = this.audioContext.createMediaStreamDestination()
      this.audioInputNode.connect(destination)
      tracks.push(destination.stream.getAudioTracks()[0])
    }
    if (this.video) {
      this.canvas = document.createElement('canvas')
      const canvasCtx = this.canvas.getContext('2d')
      if (canvasCtx === null) {
        throw Error('Failed to create 2D canvas context')
      }
      this.canvasCtx = canvasCtx
      tracks.push(this.canvas.captureStream().getVideoTracks()[0])
    }
    return new MediaStream(tracks)
  }

  async closeAudioDecoder() {
    const decoder = this.audioDecoder
    if (decoder === undefined) {
      return
    }

    if (decoder.state !== 'closed') {
      try {
        await decoder.flush()
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') {
          // デコーダーのクローズ処理と競合した場合にはここに来る（単に無視すればいい）
        } else {
          throw e
        }
      }
    }

    // await 前後で状態が変わっている可能性があるのでもう一度チェックする
    if (decoder === this.audioDecoder && decoder.state !== 'closed') {
      decoder.close()
      this.audioDecoder = undefined
    }
  }

  async closeVideoDecoder() {
    const decoder = this.videoDecoder
    if (decoder === undefined) {
      return
    }

    if (decoder.state !== 'closed') {
      try {
        await decoder.flush()
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') {
          // デコーダーのクローズ処理と競合した場合にはここに来る（単に無視すればいい）
        } else {
          throw e
        }
      }
    }

    // await 前後で状態が変わっている可能性があるのでもう一度チェックする
    if (decoder === this.videoDecoder && decoder.state !== 'closed') {
      decoder.close()
      this.videoDecoder = undefined
    }
  }

  async stop() {
    await this.closeAudioDecoder()
    await this.closeVideoDecoder()

    if (this.audioContext !== undefined) {
      await this.audioContext.close()
      this.audioContext = undefined
      this.audioInputNode = undefined
    }
    if (this.canvas !== undefined) {
      this.canvas = undefined
      this.canvasCtx = undefined
    }
  }
}

export { Mp4MediaStream, type PlayOptions }
