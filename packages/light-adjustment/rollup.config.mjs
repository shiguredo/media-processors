import * as fs from 'fs';
import * as path from 'path';
import typescript from '@rollup/plugin-typescript';
import pkg from './package.json';
import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import replace from '@rollup/plugin-replace';
import copy from 'rollup-plugin-copy';

const banner = `/**
 * ${pkg.name}
 * ${pkg.description}
 * @version: ${pkg.version}
 * @author: ${pkg.author}
 * @license: ${pkg.license}
 **/
`;

export default [
  {
    input: 'src/light_adjustment.ts',
    plugins: [
      replace({
        __LIGHT_ADJUSTMENT_WASM__: () => fs.readFileSync("dist/light_adjustment.wasm", "base64"),
        preventAssignment: true
      }),
      typescript({module: "esnext"}),
      commonjs(),
      resolve(),
      mediapipe_workaround(),
      copy({
        targets: [{
          src: [
            // node_modulesの場所が変わることがあるので、両方のパターンに対応しておく
            './node_modules/@mediapipe/selfie_segmentation/*.wasm',
            './node_modules/@mediapipe/selfie_segmentation/*.tflite',
            './node_modules/@mediapipe/selfie_segmentation/*.binarypb',
            './node_modules/@mediapipe/selfie_segmentation/*wasm_bin.js',

            '../../node_modules/@mediapipe/selfie_segmentation/*.wasm',
            '../../node_modules/@mediapipe/selfie_segmentation/*.tflite',
            '../../node_modules/@mediapipe/selfie_segmentation/*.binarypb',
            '../../node_modules/@mediapipe/selfie_segmentation/*wasm_bin.js'
          ],
          dest: 'dist/'
        }]
      })
    ],
    output: {
      sourcemap: false,
      file: './dist/light_adjustment.js',
      format: 'umd',
      name: 'Shiguredo',
      extend: true,
      banner: banner,
    }
  },
  {
    input: 'src/light_adjustment.ts',
    plugins: [
      replace({
        __LIGHT_ADJUSTMENT_WASM__: () => fs.readFileSync("dist/light_adjustment.wasm", "base64"),
        preventAssignment: true
      }),
      typescript({module: "esnext"}),
      commonjs(),
      resolve(),
      mediapipe_workaround()
    ],
    output: {
      sourcemap: false,
      file: './dist/light_adjustment.mjs',
      format: 'module',
      name: 'Shiguredo',
      extend: true,
      banner: banner,
    }
  },
];

// https://github.com/google/mediapipe/issues/2883 が本家で対応されるまでのワークアラウンド
function mediapipe_workaround() {
  return {
    name: 'mediapipe_workaround',
    load(id) {
      if (path.basename(id) === 'selfie_segmentation.js') {
        let code = fs.readFileSync(id, 'utf-8');
        code += 'exports.SelfieSegmentation = SelfieSegmentation;';
        return {code};
      } else {
        return null;
      }
    },
  };
}
