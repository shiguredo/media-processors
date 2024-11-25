class Mp4MediaStreamAudioWorkletProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this.inputBuffer = []
    this.offset = 0
    this.port.onmessage = (e) => {
      // TODO: timestamp and buffering handling
      this.inputBuffer.push(e.data)
    }
  }

  process(inputs, outputs, parameters) {
    for (let sampleIdx = 0; sampleIdx < outputs[0][0].length; sampleIdx++) {
      for (let channelIdx = 0; channelIdx < outputs[0].length; channelIdx++) {
        const outputChannel = outputs[0][channelIdx]
        const audioData = this.inputBuffer[0]
        if (audioData === undefined) {
          outputChannel[sampleIdx] = 0
        } else {
          outputChannel[sampleIdx] = audioData.samples[this.offset]
          this.offset++
          if (this.offset === this.inputBuffer[0].samples.length) {
            this.inputBuffer.shift()
            this.offset = 0
          }
        }
      }
    }
    return true
  }
}

registerProcessor('mp4-media-stream-audio-worklet-processor', Mp4MediaStreamAudioWorkletProcessor)
