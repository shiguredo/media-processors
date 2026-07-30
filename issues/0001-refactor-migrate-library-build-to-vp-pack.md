# ライブラリビルドを vp pack に移行する

- Created: 2026-07-30
- Completed: {YYYY-MM-DD}
- Branch: feature/refactor-migrate-library-build-to-vp-pack
- Polished: {YYYY-MM-DD}

## 目的

各パッケージのライブラリビルドを `vp build` + `vite-plugin-dts` から `vp pack`（tsdown）へ移行し、`.d.ts` 生成を toolchain 標準経路に一本化する。

TypeScript 7 では JavaScript Compiler API が無いため、`vite-plugin-dts`（`unplugin-dts`）は `@typescript/typescript6` の併用が必須になっている。`vp pack` の `dts` に寄せればこの二系統依存を解消できる。

## 現状

- 公開・内部パッケージの `build` スクリプトはいずれも `vp build` を使っている
  - `packages/virtual-background/package.json`
  - `packages/noise-suppression/package.json`
  - `packages/mp4-media-stream/package.json`（Wasm の `cargo build` の後に `vp build`）
  - `packages/video-track-processor/package.json`
- 各パッケージの `vite.config.ts` で `vite-plugin-dts` の `dts({ include: ["src/**/*"] })` を登録している
- ルート `package.json` の `devDependencies` に `vite-plugin-dts` と、その TypeScript 7 向けフォールバックである `@typescript/typescript6` がある
- `vp pack` は `--dts` / `pack.dts` で宣言ファイル生成を内蔵している（tsdown）
- 単純な差し替えでは足りない固有処理がある
  - `packages/virtual-background/vite.config.ts`: `mediapipeWorkaround` と `vite-plugin-static-copy`（MediaPipe の wasm / tflite / binarypb 等）
  - `packages/mp4-media-stream/vite.config.ts`: Wasm / `audio_processor.js` を文字列埋め込みする `rolldownOptions.plugins`
  - 各パッケージ共通: `build.lib`（entry / fileName / formats）と出力 banner

## 設計方針

- ライブラリ成果物の生成は `vp pack` に寄せ、アプリ向けの `vp build` と役割を分ける
- `.d.ts` は `pack.dts`（または `vp pack --dts`）で出し、`vite-plugin-dts` を削除する
- `@typescript/typescript6` は `vite-plugin-dts` 削除後に不要なら合わせて削除する（他ツールが JS API を要求しないことを確認する）
- MediaPipe 資産コピー、Wasm / audio processor 埋め込み、banner は `pack` 設定または同等の仕組みへ移す。挙動を変えない
- 公開 API（`package.json` の `exports` / `main` / `module`、`dist/*.js` / `dist/*.d.ts` のパス）は維持する

## 完了条件

- 各パッケージのビルドが `vp pack` 経由で `.js` と `.d.ts` を出力する
- `vite-plugin-dts` への依存・import・設定がリポジトリから消えている
- `@typescript/typescript6` が他用途で不要なら削除されている
- `vp run typecheck` / パッケージ build / examples build が通る
- virtual-background / noise-suppression / mp4-media-stream のデモが従来どおり動作する

## 解決方法

- 各パッケージの `vite.config.ts` で `build.lib` + `dts()` を `pack` ブロックへ移行する
- `package.json` の `build` スクリプトを `vp pack` に切り替える（mp4-media-stream は既存の `cargo build` 前段を維持する）
- virtual-background の静的コピーと mediapipe workaround、mp4-media-stream の埋め込みプラグインを `pack` 側で再現する
- ルートから `vite-plugin-dts`（と不要なら `@typescript/typescript6`）を削除し、lockfile を更新する
- examples の alias が参照する `dist` 成果物のパス・内容を確認し、デモをビルドして動作確認する
