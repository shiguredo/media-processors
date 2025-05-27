import { viteStaticCopy } from 'vite-plugin-static-copy'

import { resolve } from 'node:path'
import { defineConfig } from 'vite'

export default defineConfig({
  root: resolve(__dirname),
  base: process.env.NODE_ENV === 'production' ? '/media-processors/' : '/',
  resolve: {
    preserveSymlinks: true,
    alias: {
      '@shiguredo/virtual-background': resolve(
        __dirname,
        '../packages/virtual-background/dist/virtual_background.js',
      ),
      '@shiguredo/noise-suppression': resolve(
        __dirname,
        '../packages/noise-suppression/dist/noise_suppression.js',
      ),
      '@shiguredo/mp4-media-stream': resolve(
        __dirname,
        '../packages/mp4-media-stream/dist/mp4_media_stream.js',
      ),
    },
  },
  optimizeDeps: {
    exclude: [
      '@shiguredo/virtual-background',
      '@shiguredo/noise-suppression',
      '@shiguredo/mp4-media-stream',
    ],
  },
  build: {
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'index.html'),
        virtualBackground: resolve(__dirname, 'virtual-background/index.html'),
        noiseSuppression: resolve(__dirname, 'noise-suppression/index.html'),
        mp4MediaStream: resolve(__dirname, 'mp4-media-stream/index.html'),
      },
    },
  },
  envDir: resolve(__dirname, '..'),
  plugins: [
    viteStaticCopy({
      targets: [
        {
          src: [
            '../packages/virtual-background/dist/*.{tflite,binarypb,wasm}',
            '../packages/virtual-background/dist/*wasm_bin.js',
          ],
          dest: 'virtual-background',
        },
      ],
    }),
  ],
})
