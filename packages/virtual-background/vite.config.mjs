import { defineConfig } from "vite-plus";
import { viteStaticCopy } from "vite-plugin-static-copy";
import dts from "vite-plugin-dts";
import fs from "node:fs";
import path from "node:path";
import pkg from "./package.json";

const banner = `/**
 * ${pkg.name}
 * ${pkg.description}
 * @version: ${pkg.version}
 * @author: ${pkg.author}
 * @license: ${pkg.license}
 **/
`;

// https://github.com/google/mediapipe/issues/2883 が対応されないので、ワークアラウンドを行う
const mediapipeWorkaround = () => ({
  load(id) {
    if (path.basename(id) === "selfie_segmentation.js") {
      let code = fs.readFileSync(id, "utf8");
      code += "exports.SelfieSegmentation = SelfieSegmentation;";
      return { code };
    }
    return null;
  },
  name: "mediapipe_workaround",
});

export default defineConfig({
  build: {
    emptyOutDir: true,
    lib: {
      entry: path.resolve(__dirname, "src/virtual_background.ts"),
      fileName: "virtual_background",
      formats: ["es"],
      name: "Shiguredo",
    },
    manifest: true,
    minify: "esbuild",
    rollupOptions: {
      output: {
        banner: banner,
      },
      plugins: [mediapipeWorkaround()],
    },
    target: "es2023",
  },
  plugins: [
    dts({
      include: ["src/**/*"],
    }),
    viteStaticCopy({
      targets: [
        {
          dest: ".",
          src: [
            // Node_modules の場所が変わることがあるので、両方のパターンに対応しておく
            "./node_modules/@mediapipe/selfie_segmentation/*.wasm",
            "./node_modules/@mediapipe/selfie_segmentation/*.tflite",
            "./node_modules/@mediapipe/selfie_segmentation/*.binarypb",
            "./node_modules/@mediapipe/selfie_segmentation/*wasm_bin.js",

            "../../node_modules/@mediapipe/selfie_segmentation/*.wasm",
            "../../node_modules/@mediapipe/selfie_segmentation/*.tflite",
            "../../node_modules/@mediapipe/selfie_segmentation/*.binarypb",
            "../../node_modules/@mediapipe/selfie_segmentation/*wasm_bin.js",
          ],
        },
      ],
    }),
  ],
});
