import { LightAdjustmentGpuProcessor } from '@shiguredo/light-adjustment-gpu'

document.addEventListener('DOMContentLoaded', async () => {
  if (!LightAdjustmentGpuProcessor.isSupported()) {
    alert('Unsupported platform')
    throw Error('Unsupported platform')
  }

  let processor = undefined
  setInterval(() => {
    if (processor !== undefined) {
      const elapsed = processor.getAverageProcessedTimeMs() / 1000
      document.getElementById('elapsed').innerText = elapsed.toFixed(4).padStart(4, '0')
      const fps = processor.getFps()
      document.getElementById('fps').innerText = fps.toFixed(2).padStart(5, '0')
    }
  }, 300)

  function getUserMedia() {
    const constraints = {
      width: document.getElementById('videoWidth').value,
      height: document.getElementById('videoHeight').value,
      frameRate: { ideal: document.getElementById('videoFps').value },
      deviceId: document.getElementById('videoDevice').value,
    }
    return navigator.mediaDevices.getUserMedia({ video: constraints }).then((result) => {
      updateDeviceList()
      return result
    })
  }

  let isFirst = true
  function updateDeviceList() {
    if (!isFirst) {
      return
    }
    isFirst = false

    navigator.mediaDevices.enumerateDevices().then((devices) => {
      const videoDevices = devices.filter((device) => device.kind === 'videoinput' && device.label)
      const select = document.getElementById('videoDevice')
      videoDevices.forEach((device) => {
        const option = document.createElement('option')
        option.value = device.deviceId
        option.text = device.label
        select.appendChild(option)
      })
    })
  }

  function updateStrength(event) {
    if (processor !== undefined) {
      processor.setStrength(event.target.value)
    }
    document.getElementById('strengthValue').textContent = event.target.value
  }

  function start() {
    if (processor !== undefined) {
      processor.stopProcessing()
    }
    console.log(document.getElementById('model').value)
    processor = new LightAdjustmentGpuProcessor(
      './light-adjustment-gpu/',
      document.getElementById('model').value,
      document.getElementById('strength').value,
    )

    getUserMedia().then((stream) => {
      document.getElementById('videoOriginal').srcObject = stream

      const track = stream.getVideoTracks()[0]
      const options = {}
      processor.startProcessing(track, options).then((processed_track) => {
        document.getElementById('videoProcessed').srcObject = new MediaStream([processed_track])
      })
    })

    document.getElementById('strength').addEventListener('change', updateStrength)
  }
  start()
})
