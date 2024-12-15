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
      entry: resolve(__dirname, 'src/noise_suppression.ts'),
      formats: ['es'],
      name: 'Shiguredo',
      fileName: 'noise_suppression',
    },
    rollupOptions: {
      output: {
        banner: banner,
      },
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
            './node_modules/@shiguredo/rnnoise-wasm/dist/*.wasm',
            '../../node_modules/@shiguredo/rnnoise-wasm/dist/*.wasm'
          ],
          dest: '.',
        },
      ],
    }),
  ],
})
