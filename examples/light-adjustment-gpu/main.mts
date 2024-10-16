import { LightAdjustmentGpuProcessor } from '@shiguredo/light-adjustment-gpu'

document.addEventListener('DOMContentLoaded', async () => {
  if (!LightAdjustmentGpuProcessor.isSupported()) {
    alert('Unsupported platform')
    throw Error('Unsupported platform')
  }

  let processor: LightAdjustmentGpuProcessor
  setInterval(() => {
    if (processor !== undefined) {
      const elapsed = processor.getAverageProcessedTimeMs() / 1000
      const elapsedElement = document.getElementById('elapsed') as HTMLSpanElement
      elapsedElement.textContent = elapsed.toFixed(4).padStart(4, '0')
      const fps = processor.getFps()
      const fpsElement = document.getElementById('fps') as HTMLSpanElement
      fpsElement.textContent = fps.toFixed(2).padStart(5, '0')
    }
  }, 300)

  function getUserMedia() {
    const constraints = {
      width: (document.getElementById('videoWidth') as HTMLInputElement).value,
      height: (document.getElementById('videoHeight') as HTMLInputElement).value,
      frameRate: { ideal: (document.getElementById('videoFps') as HTMLInputElement).value },
      deviceId: (document.getElementById('videoDevice') as HTMLInputElement).value,
    }
    return navigator.mediaDevices.getUserMedia({ video: constraints }).then((result) => {
      updateDeviceList()
      return result
    })
  }

  let isFirst = true
  async function updateDeviceList() {
    if (!isFirst) {
      return
    }
    isFirst = false

    const devices = await navigator.mediaDevices.enumerateDevices()
    const videoDevices = devices.filter((device) => device.kind === 'videoinput' && device.label)
    const select = document.getElementById('videoDevice') as HTMLSelectElement
    for (const device of videoDevices) {
      const option = document.createElement('option')
      option.value = device.deviceId
      option.text = device.label
      select.appendChild(option)
    }
  }

  function updateStrength(event: Event) {
    if (processor !== undefined) {
      processor.setStrength((event.target as HTMLInputElement).value)
    }
    const strengthValueElement = document.getElementById('strengthValue')
    if (strengthValueElement !== null) {
      strengthValueElement.textContent = (event.target as HTMLInputElement).value
    }
  }

  async function start() {
    if (processor !== undefined) {
      processor.stopProcessing()
    }
    processor = new LightAdjustmentGpuProcessor(
      '',
      (document.getElementById('model') as HTMLInputElement).value,
      (document.getElementById('strength') as HTMLInputElement).value,
    )

    const stream = await getUserMedia()
    const videoOriginalElement = document.getElementById('videoOriginal') as HTMLVideoElement
    videoOriginalElement.srcObject = stream

    const track = stream.getVideoTracks()[0]
    const options = {}
    const processedTrack = await processor.startProcessing(track, options)
    const videoProcessedElement = document.getElementById('videoProcessed') as HTMLVideoElement
    videoProcessedElement.srcObject = new MediaStream([processedTrack])

    const strengthElement = document.getElementById('strength') as HTMLInputElement
    strengthElement.addEventListener('change', updateStrength)
  }

  const startButton = document.getElementById('start') as HTMLButtonElement
  startButton.addEventListener('click', start)

  start()
})
