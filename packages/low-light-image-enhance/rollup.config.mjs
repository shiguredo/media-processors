import * as fs from "fs";
import * as path from "path";
import typescript from "@rollup/plugin-typescript";
import pkg from "./package.json";
import commonjs from "@rollup/plugin-commonjs";
import resolve from "@rollup/plugin-node-resolve";
import replace from "@rollup/plugin-replace";
import copy from "rollup-plugin-copy";

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
    input: "src/low_light_image_enhance.ts",
    plugins: [
      typescript({ module: "esnext" }),
      commonjs(),
      resolve(),
      copy({
        targets: [
          {
            src: [
              "./node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm",
              "./node_modules/onnxruntime-web/dist/ort-wasm-simd.wasm",
              "./node_modules/onnxruntime-web/dist/ort-wasm-threaded.wasm",
              "./node_modules/onnxruntime-web/dist/ort-wasm.wasm",
              "./node_modules/@tensorflow/tfjs-tflite/dist/tflite_web_api_cc_simd_threaded.js",
              "./node_modules/@tensorflow/tfjs-tflite/dist/tflite_web_api_cc_simd_threaded.wasm",
              "../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm",
              "../../node_modules/onnxruntime-web/dist/ort-wasm-simd.wasm",
              "../../node_modules/onnxruntime-web/dist/ort-wasm-threaded.wasm",
              "../../node_modules/onnxruntime-web/dist/ort-wasm.wasm",
              "../../node_modules/@tensorflow/tfjs-tflite/dist/tflite_web_api_cc_simd_threaded.js",
              "../../node_modules/@tensorflow/tfjs-tflite/dist/tflite_web_api_cc_simd_threaded.wasm",
              "./model/tfjs_model_*",
            ],
            dest: "dist/",
          },
        ],
      }),
    ],
    output: {
      sourcemap: false,
      file: "./dist/low_light_image_enhance.js",
      format: "umd",
      name: "Shiguredo",
      extend: true,
      banner: banner,
    },
  },
  {
    input: "src/low_light_image_enhance.ts",
    plugins: [typescript({ module: "esnext" }), commonjs(), resolve()],
    output: {
      sourcemap: false,
      file: "./dist/low_light_image_enhance.mjs",
      format: "module",
      name: "Shiguredo",
      extend: true,
      banner: banner,
    },
  },
];
