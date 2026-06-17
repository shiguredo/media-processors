import { defineConfig, mergeConfig } from "vite-plus/test/config";
import viteConfig from "./vite.config.js";

// vite-plus のテスト設定をパッケージのビルド設定とマージする
// jsdom 環境で globals を有効にする
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: "jsdom",
      globals: true,
      include: ["tests/**/*.test.ts"],
    },
  }),
);
