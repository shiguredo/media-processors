class Mp4MediaStreamAudioWorkletProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this.inputBuffer = []
    this.offset = 0
    this.port.onmessage = (e) => {
      this.inputBuffer.push(e.data)
    }
  }

  process(inputs, outputs, parameters) {
    const outputChannel = outputs[0][0]
    for (let i = 0; i < outputChannel.length; i++) {
      const audioData = this.inputBuffer[0]
      if (audioData === undefined) {
        outputChannel[i] = 0
      } else {
        outputChannel[i] = audioData[this.offset]
        this.offset++
        if (this.offset === audioData.length) {
          this.inputBuffer.shift()
          this.offset = 0
        }
      }
    }
    return true
  }
}

registerProcessor('mp4-media-stream-audio-worklet-processor', Mp4MediaStreamAudioWorkletProcessor)
