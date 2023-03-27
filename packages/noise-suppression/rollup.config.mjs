import typescript from '@rollup/plugin-typescript';
import pkg from './package.json';
import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
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
    input: 'src/noise_suppression.ts',
    plugins: [
      typescript({module: "esnext"}),
      commonjs(),
      resolve(),
      copy({
        targets: [{
          src: [
            // node_modulesの場所が変わることがあるので、両方のパターンに対応しておく
            './node_modules/@shiguredo/rnnoise-wasm/dist/*.wasm',
            '../../node_modules/@shiguredo/rnnoise-wasm/dist/*.wasm'
          ],
          dest: 'dist/'
        }]
      })
    ],
    output: {
      sourcemap: false,
      file: './dist/noise_suppression.js',
      format: 'umd',
      name: 'Shiguredo',
      extend: true,
      banner: banner,
    }
  },
  {
    input: 'src/noise_suppression.ts',
    plugins: [
      typescript({module: "esnext"}),
      commonjs(),
      resolve()
    ],
    output: {
      sourcemap: false,
      file: './dist/noise_suppression.mjs',
      format: 'module',
      name: 'Shiguredo',
      extend: true,
      banner: banner,
    }
  },
];
