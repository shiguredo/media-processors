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
    input: 'src/low_light_image_enhance.ts',
    plugins: [
      typescript({module: "esnext"}),
      commonjs(),
      resolve(),
      copy({
        targets: [{
          src: [
            './model/semantic_guided_llie_HxW.onnx',
          ],
          dest: 'dist/'
        }]
      })
    ],
    output: {
      sourcemap: false,
      file: './dist/low_light_image_enhance.js',
      format: 'umd',
      name: 'Shiguredo',
      extend: true,
      banner: banner,
    }
  },
  {
    input: 'src/low_light_image_enhance.ts',
    plugins: [
      typescript({module: "esnext"}),
      commonjs(),
      resolve(),
    ],
    output: {
      sourcemap: false,
      file: './dist/low_light_image_enhance.mjs',
      format: 'module',
      name: 'Shiguredo',
      extend: true,
      banner: banner,
    }
  },
];
