import { resolve } from 'node:path'
import { defineConfig } from 'vite'

export default defineConfig({
  resolve: {
    preserveSymlinks: true,
  },
  optimizeDeps: {
    exclude: [
      '@shiguredo/virtual-background',
      '@shiguredo/noise-suppression',
      '@shiguredo/light-adjustment',
      '@shiguredo/light-adjustment-gpu',
    ],
  },
  build: {
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'index.html'),
        virtualBackground: resolve(__dirname, 'virtual-background/index.html'),
        lightAdjustment: resolve(__dirname, 'light-adjustment/index.html'),
        lightAdjustmentGpu: resolve(__dirname, 'light-adjustment-gpu/index.html'),
        noiseSuppression: resolve(__dirname, 'noise-suppression/index.html'),
        videoMultiProcessors: resolve(__dirname, 'video-multi-processors/index.html'),
        videoMultiProcessorsGpu: resolve(__dirname, 'video-multi-processors-gpu/index.html'),
      },
    },
  },
  envDir: resolve(__dirname, './'),
})
