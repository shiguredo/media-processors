import { resolve } from "node:path";
import { defineConfig } from "vite";
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
    minify: "esbuild",
    target: "es2023",
    emptyOutDir: true,
    manifest: true,
    lib: {
      entry: resolve(__dirname, "src/noise_suppression.ts"),
      formats: ["es"],
      name: "Shiguredo",
      fileName: "noise_suppression",
    },
    rollupOptions: {
      output: {
        banner: banner,
      },
    },
  },
  plugins: [
    dts({
      include: ["src/**/*"],
    }),
  ],
});
