import fs from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'
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
      entry: resolve(__dirname, 'src/mp4_media_stream.ts'),
      formats: ['es'],
      name: 'Shiguredo',
      fileName: 'mp4_media_stream',
    },
    rollupOptions: {
      output: {
        banner: banner,
      },
      plugins: [
        {
          name: 'wasm-loader',
          transform(code) {
            return code.replace(
              /__WASM__/g,
              () => fs.readFileSync(
                "../../target/wasm32-unknown-unknown/release/mp4_media_stream.wasm",
                "base64"
              )
            )
          }
        },
        {
          name: 'audio-processor-loader',
          transform(code) {
            return code.replace(
              /__AUDIO_PROCESSOR__/g,
              () => fs.readFileSync("src/audio_processor.js")
            );
          }
        }
      ],
    },
  },
  plugins: [
    dts({
      include: ['src/**/*'],
    }),
  ],
})
