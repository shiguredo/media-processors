import { resolve } from "node:path";
import { defineConfig } from "vite-plus";
import { viteStaticCopy } from "vite-plugin-static-copy";

export default defineConfig({
  base: process.env.NODE_ENV === "production" ? "/media-processors/" : "/",
  build: {
    // sora-js-sdk と同様に Rolldown のオプションで各ページのエントリを指定する
    rolldownOptions: {
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
    // workspace パッケージは dist エイリアスで解決するため事前バンドルから除外する
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
          // Vite-plugin-static-copy v4 は ../ を含む src のディレクトリ構造を
          // Dest 以下に保持するため、rename で packages/virtual-background/dist の
          // 3 階層分を打ち消してフラットにする
          rename: (name: string, ext: string) => `../../../${name}.${ext}`,
          src: [
            "../packages/virtual-background/dist/*.{tflite,binarypb,wasm}",
            "../packages/virtual-background/dist/*wasm_bin.js",
          ],
        },
      ],
    }),
  ],
  resolve: {
    // workspace 内のパッケージはビルド済みの dist ファイルを直接参照する
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
