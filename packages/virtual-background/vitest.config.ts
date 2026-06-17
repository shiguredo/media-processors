import { defineConfig, mergeConfig } from "vite-plus/test/config";
import viteConfig from "./vite.config.js";

// テストは vite-plus / vitest で実行する
// 現状テストファイルがないため、テストが無くても成功するようにしておく
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: "jsdom",
      globals: true,
      include: ["tests/**/*.test.ts"],
      passWithNoTests: true,
    },
  }),
);
