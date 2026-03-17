import { defineConfig } from "vite-plus";
import { resolve } from "node:path";
import dts from "vite-plugin-dts";
import fs from "node:fs";
import pkg from "./package.json";

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
      entry: resolve(__dirname, "src/mp4_media_stream.ts"),
      fileName: "mp4_media_stream",
      formats: ["es"],
      name: "Shiguredo",
    },
    manifest: true,
    minify: "esbuild",
    rollupOptions: {
      output: {
        banner: banner,
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
    target: "es2023",
  },
  plugins: [
    dts({
      include: ["src/**/*"],
    }),
  ],
});
