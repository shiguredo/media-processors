import { LightAdjustmentGpuProcessor } from '@shiguredo/light-adjustment-gpu'
import { VirtualBackgroundProcessor } from '@shiguredo/virtual-background'

document.addEventListener('DOMContentLoaded', async () => {
  if (!VirtualBackgroundProcessor.isSupported() || !LightAdjustmentGpuProcessor.isSupported()) {
    alert('Unsupported platform')
    throw Error('Unsupported platform')
  }
  const lightAdjustmentProcessor = new LightAdjustmentGpuProcessor(
    './light-adjustment-gpu/',
    'semantic_guided_llie_648x480',
    0.5,
  )
  const virtualBackgroundProcessor = new VirtualBackgroundProcessor('./virtual-background/')
  setInterval(() => {
    const elapsed0 = lightAdjustmentProcessor.getAverageProcessedTimeMs() / 1000
    document.getElementById('elapsed0').innerText = elapsed0.toFixed(4).padStart(4, '0')
    const fps0 = lightAdjustmentProcessor.getFps()
    document.getElementById('fps0').innerText = fps0.toFixed(2).padStart(5, '0')
    const elapsed1 = virtualBackgroundProcessor.getAverageProcessedTimeMs() / 1000
    document.getElementById('elapsed1').innerText = elapsed1.toFixed(4).padStart(4, '0')
    const fps1 = virtualBackgroundProcessor.getFps()
    document.getElementById('fps1').innerText = fps1.toFixed(2).padStart(5, '0')
  }, 300)

  function getUserMedia() {
    const constraints = {
      width: 320,
      height: 240,
    }
    return navigator.mediaDevices.getUserMedia({ video: constraints })
  }

  getUserMedia().then(async (stream) => {
    const backgroundImage = new Image()
    backgroundImage.src = 'background.jpg'

    const originalTrack = stream.getVideoTracks()[0]
    const processedTrack0 = await lightAdjustmentProcessor.startProcessing(originalTrack)
    const processedTrack1 = await virtualBackgroundProcessor.startProcessing(processedTrack0, {
      backgroundImage,
    })

    document.getElementById('originalVideo').srcObject = new MediaStream([originalTrack])
    document.getElementById('processedVideo').srcObject = new MediaStream([processedTrack1])
  })
})
