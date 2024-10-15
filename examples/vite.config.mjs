import { viteStaticCopy } from 'vite-plugin-static-copy'

import { resolve } from 'node:path'
import { defineConfig } from 'vite'

export default defineConfig({
  base: process.env.NODE_ENV === 'production' ? '/media-processors/' : '/',
  resolve: {
    preserveSymlinks: true,
    alias: {
      '@shiguredo/virtual-background': resolve(
        __dirname,
        '../packages/virtual-background/dist/virtual_background.mjs',
      ),
      '@shiguredo/noise-suppression': resolve(
        __dirname,
        '../packages/noise-suppression/dist/noise_suppression.mjs',
      ),
      '@shiguredo/light-adjustment': resolve(
        __dirname,
        '../packages/light-adjustment/dist/light_adjustment.mjs',
      ),
      '@shiguredo/light-adjustment-gpu': resolve(
        __dirname,
        '../packages/light-adjustment-gpu/dist/light_adjustment_gpu.mjs',
      ),
      '@shiguredo/mp4-media-stream': resolve(__dirname, '../packages/mp4-media-stream/dist/mp4_media_stream.mjs'),
    },
  },
  optimizeDeps: {
    exclude: [
      '@shiguredo/virtual-background',
      '@shiguredo/noise-suppression',
      '@shiguredo/light-adjustment',
      '@shiguredo/light-adjustment-gpu',
      '@shiguredo/mp4-media-stream',
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
        mp4MediaStream: resolve(__dirname, 'mp4-media-stream/index.html'),
      },
    },
  },
  envDir: resolve(__dirname, './'),
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
        {
          src: [
            '../packages/light-adjustment/dist/*.{tflite,binarypb,wasm}',
            '../packages/light-adjustment/dist/*wasm_bin.js',
            '../packages/light-adjustment/dist/tfjs_model*',
          ],
          dest: 'light-adjustment',
        },
        {
          src: ['../packages/light-adjustment-gpu/dist/tfjs_model*'],
          dest: 'light-adjustment-gpu',
        },
        {
          src: ['../packages/noise-suppression/dist/*.wasm'],
          dest: 'noise-suppression',
        },
      ],
    }),
  ],
})
