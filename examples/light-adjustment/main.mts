import { LightAdjustmentProcessor } from '@shiguredo/light-adjustment'

document.addEventListener('DOMContentLoaded', async () => {
  if (!LightAdjustmentProcessor.isSupported()) {
    alert('Unsupported platform')
    throw Error('Unsupported platform')
  }

  const processor = new LightAdjustmentProcessor()
  setInterval(() => {
    const elapsed = processor.getAverageProcessedTimeMs() / 1000
    document.getElementById('elapsed').innerText = elapsed.toFixed(4).padStart(4, '0')
    const fps = processor.getFps()
    document.getElementById('fps').innerText = fps.toFixed(2).padStart(5, '0')
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

  function updateOption(name) {
    var options = {}

    if (name == 'focusMask') {
      switch (document.getElementById(name).value) {
        case 'uniform':
          options[name] = new UniformFocusMask()
          break
        case 'center':
          options[name] = new CenterFocusMask()
          break
        case 'selfieSegmentation':
          options[name] = new SelfieSegmentationFocusMask('./light-adjustment/')
          break
      }
    } else {
      const value = Number(document.getElementById(name).value)
      document.getElementById(`${name}-value`).innerText = value
      options[name] = value
    }

    processor.updateOptions(options)
  }

  function start() {
    processor.stopProcessing()

    getUserMedia().then((stream) => {
      document.getElementById('videoOriginal').srcObject = stream

      const track = stream.getVideoTracks()[0]
      const options = {
        focusMask: new SelfieSegmentationFocusMask('./light-adjustment/'),
      }
      processor.startProcessing(track, options).then((processed_track) => {
        document.getElementById('videoProcessed').srcObject = new MediaStream([processed_track])
      })
    })
  }
  start()
})
