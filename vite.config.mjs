import { resolve } from 'node:path'
import { defineConfig } from 'vite'

// root が examples なので examples/dist にビルドされる

export default defineConfig({
  root: resolve(__dirname, 'examples'),
  resolve: {
    preserveSymlinks: true,
  },
  optimizeDeps: {
    exclude: ['sora-js-sdk'],
  },
  build: {
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'examples/index.html'),
        virtualBackground: resolve(__dirname, 'examples/virtual-background/index.html'),
      },
    },
  },
  envDir: resolve(__dirname, './'),
})
