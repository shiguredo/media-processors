import fs from "node:fs";
import path, { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite-plus";
import dts from "vite-plugin-dts";
import { viteStaticCopy } from "vite-plugin-static-copy";
import pkg from "./package.json" with { type: "json" };

const __dirname = dirname(fileURLToPath(import.meta.url));

const banner = `/**
 * ${pkg.name}
 * ${pkg.description}
 * @version: ${pkg.version}
 * @author: ${pkg.author}
 * @license: ${pkg.license}
 **/
`;

// mediapipe の IIFE は SelfieSegmentation を動的に exports へ設定するが、
// Rolldown の静的解析では named export として認識できないため明示的な代入文を追加する
// ref: https://github.com/google/mediapipe/issues/2883
const mediapipeWorkaround = () => ({
  name: "mediapipe_workaround",
  load(id: string) {
    if (path.basename(id) === "selfie_segmentation.js") {
      let code = fs.readFileSync(id, "utf8");
      code += "exports.SelfieSegmentation = exports.SelfieSegmentation;";
      return { code };
    }
    return null;
  },
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
    rolldownOptions: {
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
          rename: { stripBase: true },
          src: [
            "./node_modules/@mediapipe/selfie_segmentation/*.wasm",
            "./node_modules/@mediapipe/selfie_segmentation/*.tflite",
            "./node_modules/@mediapipe/selfie_segmentation/*.binarypb",
            "./node_modules/@mediapipe/selfie_segmentation/*wasm_bin.js",
          ],
        },
      ],
    }),
  ],
});
