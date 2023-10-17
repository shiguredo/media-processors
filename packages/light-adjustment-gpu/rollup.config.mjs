import * as fs from "fs";
import * as path from "path";
import typescript from "@rollup/plugin-typescript";
import pkg from "./package.json";
import commonjs from "@rollup/plugin-commonjs";
import resolve from "@rollup/plugin-node-resolve";
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
    input: "src/light_adjustment_gpu.ts",
    plugins: [
      typescript({ module: "esnext" }),
      commonjs(),
      resolve(),
      copy({
        targets: [
          {
            src: ["./model/tfjs_model_*"],
            dest: "dist/",
          },
        ],
      }),
    ],
    output: {
      sourcemap: false,
      file: "./dist/light_adjustment_gpu.js",
      format: "umd",
      name: "Shiguredo",
      extend: true,
      banner: banner,
    },
  },
  {
    input: "src/light_adjustment_gpu.ts",
    plugins: [typescript({ module: "esnext" }), commonjs(), resolve()],
    output: {
      sourcemap: false,
      file: "./dist/light_adjustment_gpu.mjs",
      format: "module",
      name: "Shiguredo",
      extend: true,
      banner: banner,
    },
  },
];
