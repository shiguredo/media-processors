import { Mp4MediaStream } from '@shiguredo/mp4-media-stream'

document.addEventListener('DOMContentLoaded', async () => {
  let mp4MediaStream

  if (!Mp4MediaStream.isSupported()) {
    alert('Unsupported platform')
    throw Error('Unsupported platform')
  }

  async function play() {
    let mp4File = getInputFile()

    if (mp4MediaStream !== undefined) {
      mp4MediaStream.stop()
    }
    mp4MediaStream = await Mp4MediaStream.load(mp4File)

    const options = {
      repeat: document.getElementById('repeat').checked,
    }
    const stream = mp4MediaStream.play(options)

    let output = document.getElementById('output')
    output.srcObject = stream
    // TODO: stream.getTracks()[0].stop()
  }

  function getInputFile() {
    const input = document.getElementById('input')
    const files = input.files
    if (files === null || files.length === 0) {
      return
    }
    return files[0]
  }

  document.getElementById('input').addEventListener('change', play)
})
