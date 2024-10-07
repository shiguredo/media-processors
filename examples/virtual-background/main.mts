import { VirtualBackgroundProcessor } from '@shiguredo/virtual-background'

document.addEventListener('DOMContentLoaded', async () => {
  if (!VirtualBackgroundProcessor.isSupported()) {
    alert('Unsupported platform')
    throw Error('Unsupported platform')
  }

  const assetsPath = '.'
  const processor = new VirtualBackgroundProcessor(assetsPath)
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
      // biome-ignore lint/complexity/noForEach: <explanation>
      videoDevices.forEach((device) => {
        const option = document.createElement('option')
        option.value = device.deviceId
        option.text = device.label
        select.appendChild(option)
      })
    })
  }

  function showOriginalVideo() {
    processor.stopProcessing()

    const videoElement = document.getElementById('video')
    getUserMedia().then((stream) => {
      videoElement.srcObject = stream
    })
  }

  function showProcessedVideo() {
    processor.stopProcessing()

    const videoElement = document.getElementById('video')
    getUserMedia().then((stream) => {
      const track = stream.getVideoTracks()[0]

      let blurRadius: number
      let backgroundImage: HTMLImageElement
      const virtualBackgroundType = document.getElementById(
        'virtualBackgroundType',
      ) as HTMLSelectElement
      if (virtualBackgroundType === null) {
        return
      }
      switch (virtualBackgroundType.value) {
        case 'blur-5':
          blurRadius = 5
          break
        case 'blur-15':
          blurRadius = 15
          break
        case 'image':
          backgroundImage = new Image()
          backgroundImage.src = 'background.jpg'
          break
        default:
          return
      }

      const options = { blurRadius, backgroundImage }
      processor.startProcessing(track, options).then((processed_track) => {
        videoElement.srcObject = new MediaStream([processed_track])
      })
    })
  }

  document.getElementById('virtualBackgroundOn')?.addEventListener('click', showProcessedVideo)
  document.getElementById('virtualBackgroundOff')?.addEventListener('click', showOriginalVideo)

  showOriginalVideo()
})
