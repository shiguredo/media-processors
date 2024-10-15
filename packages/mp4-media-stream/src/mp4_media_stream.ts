const WASM_BASE64 = '__WASM__'

interface Mp4MediaStreamPlayOptions {
  repeat?: boolean
}

class Mp4MediaStream {
  private engine: Engine

  constructor(wasm: WebAssembly.Instance) {
    this.engine = new Engine(wasm, wasm.exports.memory as WebAssembly.Memory)
  }

  static isSupported(): boolean {
    return !(typeof MediaStreamTrackGenerator === 'undefined')
  }

  static async loadMp4(mp4: Blob): Promise<Mp4MediaStream> {
    const engineRef: { value?: Engine } = { value: undefined }
    const importObject = {
      env: {
        now() {
          return performance.now()
        },
        consoleLog(messageWasmJson: number) {
          if (engineRef.value) {
            engineRef.value.consoleLog(messageWasmJson)
          }
        },
        sleep(resultTx: number, duration: number) {
          if (engineRef.value) {
            engineRef.value.sleep(resultTx, duration)
          }
        },
        createVideoDecoder(playerId: number, configWasmJson: number) {
          if (engineRef.value) {
            engineRef.value.createVideoDecoder(playerId, configWasmJson)
          }
        },
        createAudioDecoder(playerId: number, configWasmJson: number) {
          if (engineRef.value) {
            engineRef.value.createAudioDecoder(playerId, configWasmJson)
          }
        },
        closeDecoder(playerId: number, decoderId: number) {
          if (engineRef.value) {
            engineRef.value.closeDecoder(playerId, decoderId)
          }
        },
        decode(
          playerId: number,
          decoderId: number,
          metadataWasmJson: number,
          dataOffset: number,
          dataLen: number,
        ) {
          if (engineRef.value) {
            engineRef.value.decode(playerId, decoderId, metadataWasmJson, dataOffset, dataLen)
          }
        },
        notifyEos(playerId: number) {
          if (engineRef.value) {
            engineRef.value.notifyEos(playerId)
          }
        },
      },
    }
    const wasmResults = await WebAssembly.instantiateStreaming(
      fetch(`data:application/wasm;base64,${WASM_BASE64}`),
      importObject,
    )

    const stream = new Mp4MediaStream(wasmResults.instance)
    engineRef.value = stream.engine

    const mp4Bytes = new Uint8Array(await mp4.arrayBuffer())
    await stream.engine.loadMp4(mp4Bytes)

    return stream
  }

  play(options: Mp4MediaStreamPlayOptions = {}): MediaStream {
    return this.engine.play(options)
  }
}

type Mp4Info = {
  audioConfigs: [AudioDecoderConfig]
  videoConfigs: [VideoDecoderConfig]
}

class Engine {
  private wasm: WebAssembly.Instance
  private memory: WebAssembly.Memory
  private engine: number
  private info?: Mp4Info
  private players: Map<number, Player> = new Map()
  private nextPlayerId = 0

  constructor(wasm: WebAssembly.Instance, memory: WebAssembly.Memory) {
    this.wasm = wasm
    this.memory = memory
    this.engine = (this.wasm.exports.newEngine as CallableFunction)()
  }

  // TODO: load() でいいかも
  async loadMp4(mp4Bytes: Uint8Array): Promise<{ audio: boolean; video: boolean }> {
    const mp4WasmBytes = this.toWasmBytes(mp4Bytes)
    const resultWasmJson = (this.wasm.exports.loadMp4 as CallableFunction)(
      this.engine,
      mp4WasmBytes,
    )

    // MP4 内に含まれる映像・音声を WebCodecs のデコーダー扱えるかどうかをチェックする
    const info = this.wasmResultToValue(resultWasmJson) as {
      audioConfigs: [AudioDecoderConfig]
      videoConfigs: [VideoDecoderConfig]
    }
    for (const config of info.audioConfigs) {
      if (!(await AudioDecoder.isConfigSupported(config)).supported) {
        // TODO: ちゃんとする
        throw 'unsupported audio codec'
      }
    }
    for (const config of info.videoConfigs) {
      if (config.description !== undefined) {
        // @ts-ignore TS2488: TODO
        config.description = new Uint8Array(config.description)
      }
      if (!(await VideoDecoder.isConfigSupported(config)).supported) {
        // TODO: ちゃんとする
        throw 'unsupported audio codec'
      }
      this.info = info
    }

    // TODO: remove
    console.log(JSON.stringify(info))

    return { audio: info.audioConfigs.length > 0, video: info.videoConfigs.length > 0 }
  }

  play(options: Mp4MediaStreamPlayOptions = {}): MediaStream {
    if (this.info === undefined) {
      throw 'bug'
    }

    const playerId = this.nextPlayerId
    this.nextPlayerId += 1

    const player = new Player(this.info.audioConfigs.length > 0, this.info.videoConfigs.length > 0)
    this.players.set(playerId, player)
    ;(this.wasm.exports.play as CallableFunction)(
      this.engine,
      playerId,
      this.valueToWasmJson(options),
    )
    console.log('player created')

    return player.createMediaStream()
  }

  stop(playerId: number) {
    console.log('stop player')
    const player = this.players.get(playerId)
    if (player === undefined) {
      return
    }
    ;(this.wasm.exports.stop as CallableFunction)(this.engine, playerId)
    this.closeDecoder(playerId, 0)
    this.closeDecoder(playerId, 1)
    this.players.delete(playerId)
  }

  consoleLog(messageWasmJson: number) {
    const message = this.wasmJsonToValue(messageWasmJson)
    console.log(message)
  }

  async sleep(resultTx: number, duration: number) {
    setTimeout(() => {
      ;(this.wasm.exports.awake as CallableFunction)(this.engine, resultTx)
    }, duration)
  }

  createVideoDecoder(playerId: number, configWasmJson: number) {
    console.log('createVideoDecoder')
    const player = this.players.get(playerId)
    if (player === undefined) {
      throw 'TODO-1'
    }
    if (player.videoDecoder !== undefined) {
      throw 'TODO-2'
    }

    const config = this.wasmJsonToValue(configWasmJson) as VideoDecoderConfig
    // @ts-ignore TS2488: TODO
    config.description = new Uint8Array(config.description)

    const init = {
      output: async (frame: VideoFrame) => {
        if (player.videoWriter === undefined) {
          throw 'bug'
        }

        // TODO: error handling (stop engine)
        try {
          await player.videoWriter.write(frame)
        } catch (e) {
          this.stop(playerId)
          throw e // TODO
        }
      },
      error: (error: DOMException) => {
        // TODO: ちゃんとしたエラーハンドリング
        throw error
      },
    }

    player.videoDecoder = new VideoDecoder(init)
    player.videoDecoder.configure(config)
    console.log('video decoder created')
  }

  createAudioDecoder(playerId: number, configWasmJson: number) {
    console.log('createAudioDecoder')
    const player = this.players.get(playerId)
    if (player === undefined) {
      throw 'TODO-3'
    }
    if (player.audioDecoder !== undefined) {
      throw 'TODO-4'
    }

    const config = this.wasmJsonToValue(configWasmJson) as AudioDecoderConfig
    const init = {
      output: async (data: AudioData) => {
        if (player.audioWriter === undefined) {
          throw 'bug'
        }

        try {
          await player.audioWriter.write(data)
        } catch (e) {
          this.stop(playerId)
          throw e // TODO: エラーの種類によって処理を分ける（closed なら正常系）
        }
      },
      error: (error: DOMException) => {
        // TODO: ちゃんとしたエラーハンドリング
        throw error
      },
    }

    player.audioDecoder = new AudioDecoder(init)
    player.audioDecoder.configure(config)
    console.log('audio decoder created')
  }

  async closeDecoder(playerId: number, decoderId: number) {
    console.log('close decoder')
    const player = this.players.get(playerId)
    if (player === undefined) {
      return
    }

    if (
      decoderId === 0 &&
      player.videoDecoder !== undefined &&
      player.videoWriter !== undefined &&
      player.videoDecoder.state !== 'closed'
    ) {
      await player.videoDecoder.flush()
      player.videoDecoder.close()
      player.videoDecoder = undefined
      player.videoWriter.close()
      player.videoWriter = undefined
    } else if (
      player.audioDecoder !== undefined &&
      player.audioWriter !== undefined &&
      player.audioDecoder.state !== 'closed'
    ) {
      await player.audioDecoder.flush()
      player.audioDecoder.close()
      player.audioDecoder = undefined
      player.audioWriter.close()
      player.audioWriter = undefined
    }
  }

  async notifyEos(playerId: number) {
    this.stop(playerId)
  }

  decode(
    playerId: number,
    decoderId: number,
    metadataWasmJson: number,
    dataOffset: number,
    dataLen: number,
  ) {
    const player = this.players.get(playerId)
    if (player === undefined) {
      throw 'TODO-6'
    }

    const chunkParams = this.wasmJsonToValue(metadataWasmJson) as
      | EncodedAudioChunkInit
      | EncodedVideoChunkInit
    const data = new Uint8Array(this.memory.buffer, dataOffset, dataLen).slice()

    chunkParams.data = data
    // @ts-ignore TS2488: TODO
    chunkParams.transfer = [data.buffer]
    if (decoderId === 0) {
      if (player.videoDecoder === undefined) {
        throw 'TODO-7'
      }
      const chunk = new EncodedVideoChunk(chunkParams)
      player.videoDecoder.decode(chunk)
    } else {
      if (player.audioDecoder === undefined) {
        throw 'TODO-8'
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
    const result = this.wasmJsonToValue(wasmResult) as { Ok?: object; Err?: object }
    if (result.Err !== undefined) {
      // TODO: error handling
      throw JSON.stringify(result.Err)
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

class Player {
  audio: boolean
  video: boolean
  audioDecoder?: AudioDecoder
  videoDecoder?: VideoDecoder
  audioWriter?: WritableStreamDefaultWriter
  videoWriter?: WritableStreamDefaultWriter

  constructor(audio: boolean, video: boolean) {
    this.audio = audio
    this.video = video
  }

  createMediaStream(): MediaStream {
    const tracks = []
    if (this.audio) {
      const generator = new MediaStreamTrackGenerator({ kind: 'audio' })
      tracks.push(generator)
      this.audioWriter = generator.writable.getWriter()
    }
    if (this.video) {
      const generator = new MediaStreamTrackGenerator({ kind: 'video' })
      tracks.push(generator)
      this.videoWriter = generator.writable.getWriter()
    }
    return new MediaStream(tracks)
  }
}

export { Mp4MediaStream, type Mp4MediaStreamPlayOptions }