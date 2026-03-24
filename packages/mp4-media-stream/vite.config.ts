import fs from "node:fs";
import path, { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite-plus";
import dts from "vite-plugin-dts";
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

export default defineConfig({
  build: {
    emptyOutDir: true,
    lib: {
      entry: path.resolve(__dirname, "src/mp4_media_stream.ts"),
      fileName: "mp4_media_stream",
      formats: ["es"],
      name: "Shiguredo",
    },
    manifest: true,
    minify: "esbuild",
    rolldownOptions: {
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
