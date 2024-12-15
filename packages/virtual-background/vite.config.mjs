import fs from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'
import { viteStaticCopy } from 'vite-plugin-static-copy';
import pkg from './package.json'

const banner = `/**
 * ${pkg.name}
 * ${pkg.description}
 * @version: ${pkg.version}
 * @author: ${pkg.author}
 * @license: ${pkg.license}
 **/
`

export default defineConfig({
  build: {
    minify: 'esbuild',
    target: 'es2023',
    emptyOutDir: true,
    manifest: true,
    lib: {
      entry: resolve(__dirname, 'src/virtual_background.ts'),
      formats: ['es'],
      name: 'Shiguredo',
      fileName: 'virtual_background',
    },
    rollupOptions: {
      output: {
        banner: banner,
      },
      plugins: [mediapipeWorkaround],
    },
  },
  plugins: [
    dts({
      include: ['src/**/*'],
    }),
    viteStaticCopy({
      targets: [
        {
          src: [
            // node_modulesの場所が変わることがあるので、両方のパターンに対応しておく
            './node_modules/@mediapipe/selfie_segmentation/*.wasm',
            './node_modules/@mediapipe/selfie_segmentation/*.tflite',
            './node_modules/@mediapipe/selfie_segmentation/*.binarypb',
            './node_modules/@mediapipe/selfie_segmentation/*wasm_bin.js',

            '../../node_modules/@mediapipe/selfie_segmentation/*.wasm',
            '../../node_modules/@mediapipe/selfie_segmentation/*.tflite',
            '../../node_modules/@mediapipe/selfie_segmentation/*.binarypb',
            '../../node_modules/@mediapipe/selfie_segmentation/*wasm_bin.js',
          ],
          dest: '.',
        },
      ],
    }),
  ],
})

// https://github.com/google/mediapipe/issues/2883 が対応されないので、ワークアラウンドを行う
function mediapipeWorkaround() {
  return {
    name: 'mediapipe_workaround',
    load(id) {
      if (path.basename(id) === 'selfie_segmentation.js') {
        let code = fs.readFileSync(id, 'utf-8')
        code += 'exports.SelfieSegmentation = SelfieSegmentation;'
        return { code }
      }
      return null
    },
  }
}
