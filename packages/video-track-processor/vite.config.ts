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
      entry: path.resolve(import.meta.dirname, "src/video_track_processor.ts"),
      fileName: "video_track_processor",
      formats: ["es"],
      name: "Shiguredo",
    },
    minify: "esbuild",
    rolldownOptions: {
      output: {
        banner,
      },
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
