import * as fs from 'fs';
import typescript from '@rollup/plugin-typescript';
import pkg from './package.json';
import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import replace from '@rollup/plugin-replace';

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
    input: 'src/mp4_media_stream.ts',
    plugins: [
      replace({
        __WASM__: () => fs.readFileSync("../../target/wasm32-unknown-unknown/release/mp4_media_stream.wasm", "base64"),
        preventAssignment: true
      }),
      typescript({module: "esnext"}),
      commonjs(),
      resolve()
    ],
    output: {
      sourcemap: false,
      file: './dist/mp4_media_stream.js',
      format: 'umd',
      name: 'Shiguredo',
      extend: true,
      banner: banner,
    }
  },
  {
    input: 'src/mp4_media_stream.ts',
    plugins: [
      replace({
        __WASM__: () => fs.readFileSync("../../target/wasm32-unknown-unknown/release/mp4_media_stream.wasm", "base64"),
        preventAssignment: true
      }),
      typescript({module: "esnext"}),
      commonjs(),
      resolve()
    ],
    output: {
      sourcemap: false,
      file: './dist/mp4_media_stream.mjs',
      format: 'module',
      name: 'Shiguredo',
      extend: true,
      banner: banner,
    }
  },
];
