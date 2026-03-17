import { defineConfig } from "vite-plus";
import { resolve } from "node:path";
import { viteStaticCopy } from "vite-plugin-static-copy";

export default defineConfig({
  base: process.env.NODE_ENV === "production" ? "/media-processors/" : "/",
  build: {
    rollupOptions: {
      input: {
        index: resolve(__dirname, "index.html"),
        mp4MediaStream: resolve(__dirname, "mp4-media-stream/index.html"),
        noiseSuppression: resolve(__dirname, "noise-suppression/index.html"),
        virtualBackground: resolve(__dirname, "virtual-background/index.html"),
      },
    },
  },
  envDir: resolve(__dirname, ".."),
  optimizeDeps: {
    exclude: [
      "@shiguredo/virtual-background",
      "@shiguredo/noise-suppression",
      "@shiguredo/mp4-media-stream",
    ],
  },
  plugins: [
    viteStaticCopy({
      targets: [
        {
          dest: "virtual-background",
          src: [
            "../packages/virtual-background/dist/*.{tflite,binarypb,wasm}",
            "../packages/virtual-background/dist/*wasm_bin.js",
          ],
        },
      ],
    }),
  ],
  resolve: {
    alias: {
      "@shiguredo/mp4-media-stream": resolve(
        __dirname,
        "../packages/mp4-media-stream/dist/mp4_media_stream.js",
      ),
      "@shiguredo/noise-suppression": resolve(
        __dirname,
        "../packages/noise-suppression/dist/noise_suppression.js",
      ),
      "@shiguredo/virtual-background": resolve(
        __dirname,
        "../packages/virtual-background/dist/virtual_background.js",
      ),
    },
    preserveSymlinks: true,
  },
  root: resolve(__dirname),
});
