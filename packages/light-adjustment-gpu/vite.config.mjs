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
      entry: resolve(__dirname, 'src/light_adjustment_gpu.ts'),
      formats: ['es'],
      name: 'Shiguredo',
      fileName: 'light_adjustment_gpu',
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
          src: ["./model/tfjs_model_*"],
          dest: '.',
        },
      ],
    }),
  ],
})
