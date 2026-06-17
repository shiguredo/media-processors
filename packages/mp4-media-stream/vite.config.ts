import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "vite-plus";
import dts from "vite-plugin-dts";
import pkg from "./package.json" with { type: "json" };

const banner = `/**
 * ${pkg.name}
 * ${pkg.description}
 * @version: ${pkg.version}
 * @author: ${pkg.author}
 * @license: ${pkg.license}
 **/
`;

export default defineConfig({
  build: {
    emptyOutDir: true,
    lib: {
      entry: path.resolve(import.meta.dirname, "src/mp4_media_stream.ts"),
      fileName: "mp4_media_stream",
      formats: ["es"],
      name: "Shiguredo",
    },
    minify: "esbuild",
    rolldownOptions: {
      output: {
        banner,
      },
      plugins: [
        {
          name: "wasm-loader",
          transform(code) {
            return code.replaceAll("__WASM__", () =>
              fs.readFileSync(
                "../../target/wasm32-unknown-unknown/release/mp4_media_stream.wasm",
                "base64",
              ),
            );
          },
        },
        {
          name: "audio-processor-loader",
          transform(code) {
            return code.replaceAll("__AUDIO_PROCESSOR__", () =>
              fs.readFileSync("src/audio_processor.js"),
            );
          },
        },
      ],
    },
    // ルート tsconfig.json の target と一致させる
    target: "es2022",
  },
  plugins: [
    dts({
      include: ["src/**/*"],
    }),
  ],
});
