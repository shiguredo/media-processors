import { defineConfig } from "vite-plus";
import { resolve } from "node:path";
import dts from "vite-plugin-dts";
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
      entry: resolve(__dirname, "src/video_track_processor.ts"),
      fileName: "video_track_processor",
      formats: ["es"],
      name: "Shiguredo",
    },
    manifest: true,
    minify: "esbuild",
    rollupOptions: {
      output: {
        banner: banner,
      },
    },
    target: "es2023",
  },
  plugins: [
    dts({
      include: ["src/**/*"],
    }),
  ],
});
