# ライブラリビルドを vp pack に移行する

- Created: 2026-07-30
- Completed: {YYYY-MM-DD}
- Branch: feature/refactor-migrate-library-build-to-vp-pack
- Polished: 2026-07-30

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
- 各パッケージ共通の `build.lib`（entry / fileName / formats）、`build.minify: "esbuild"`、`build.target: "es2022"`、`build.emptyOutDir: true`、`rolldownOptions.output.banner` が指定されている
- 単純な差し替えでは足りない固有処理がある
  - `packages/virtual-background/vite.config.ts`: `mediapipeWorkaround`（Rolldown プラグインの `load` フック）と `vite-plugin-static-copy`（MediaPipe の wasm / tflite / binarypb / wasm_bin.js を `dist` へコピー）
  - `packages/mp4-media-stream/vite.config.ts`: Wasm / `audio_processor.js` を文字列埋め込みする `rolldownOptions.plugins` の `transform` フック
  - `packages/virtual-background/package.json` の `dependencies` にある `@mediapipe/selfie_segmentation` と `stackblur-canvas` は、現行 `vp build` で `dist/virtual_background.js` にバンドル込みで出力されている
- examples 側は `packages/virtual-background/dist/*.{tflite,binarypb,wasm}` と `*wasm_bin.js` を `viteStaticCopy` で参照しているため、`dist` 直下に MediaPipe 資産が出力されていることが前提になっている
- `virtual-background` のみ現行 `vite-plugin-dts` の出力が `dist/virtual-background/src/virtual_background.d.ts` にネストされていて、`package.json` の `exports["."].types: "./dist/virtual_background.d.ts"` が指すパスに `.d.ts` が存在しない既存の型解決不整合がある（他 3 パッケージは `dist/<name>.d.ts` の直下に正しく出力されている）

## 設計方針

- ライブラリ成果物は `vp pack` に寄せ、`vite-plugin-dts` を削除して `.d.ts` は `pack.dts` で出す
- 公開 API（`package.json` の `exports` / `main` / `module`、`dist/<name>.js` / `dist/<name>.d.ts` のパス）は維持する。`virtual-background` の `.d.ts` は現行のネスト出力ではなく `exports["."].types` が指す `dist/virtual_background.d.ts` に配置し直す（`vp pack` の `dts` はエントリ基準で単一 `.d.ts` を出す既定挙動を利用する。既存の型解決不整合の解消を移行の副産物として取り込む）
- 挙動を変えない前提で、tsdown 既定値と現行 Vite 設定のずれを次のように吸収する
  - `pack.platform: "browser"` を明示する。tsdown 既定は `"node"` で、その場合 `fixedExtension` が既定で有効化されて ESM 出力が `dist/<name>.mjs` になり公開 API を壊す
  - `pack.entry` は `{ <name>: "src/<name>.ts" }` の Record 形式で書き、`dist/<name>.js` を維持する。string entry では入力ファイル名依存になるため公開 API を担保できない
  - `pack.hash: false` を明示する。tsdown 既定 `true` ではコード分割時のチャンクがハッシュ付きになり `main` / `module` と不一致になる可能性がある
  - `virtual-background` は `pack.deps.alwaysBundle: ["@mediapipe/selfie_segmentation", "stackblur-canvas"]` で `dependencies` の外部化を打ち消す。tsdown は既定で `dependencies` を external にするため、指定しないと現行 `dist` にバンドルされている 2 依存が実行時解決不能になる。`mediapipeWorkaround` の `load` フックも `selfie_segmentation.js` がバンドル対象であることが前提のため合わせて維持する
  - `banner` は `pack.banner: { js: banner }` として JS 出力のみに適用対象を絞る（`pack.banner` の型 `ChunkAddon` は `js` / `css` / `dts` の 3 面を持ち、string を直接渡した場合の適用対象が実装依存になるため。現行の `rolldownOptions.output.banner` は JS 出力のみに適用されている挙動と合わせる）。Rolldown プラグイン（`mediapipeWorkaround` / `wasm-loader` / `audio-processor-loader`）は `pack.plugins`、`viteStaticCopy` の対象は `pack.copy` に移す
  - `build.target: "es2022"` は `pack.target: "es2022"` へ、`build.emptyOutDir: true` は `pack.clean` へ値をそのまま写す
  - `build.minify: "esbuild"` は `pack.minify: true` に置き換える。tsdown の `pack.minify` の型は `boolean | "dce-only" | MinifyOptions` で文字列 `"esbuild"` は受け付けず、`MinifyOptions` は `@voidzero-dev/vite-plus-core/rolldown` 側の型で minify を有効化すると minifier 実装は esbuild から Rolldown 内蔵の minifier に切り替わる（最小化を有効にする挙動自体は維持されるが、成果物の記号名・サイズが同一になる保証はない点を了承する）
- `mp4-media-stream/vite.config.ts` の `fs.readFileSync("../../target/...")` と `fs.readFileSync("src/audio_processor.js", ...)` はいずれも現行 `vp build` のパッケージ cwd 相対で解決している。`vp pack` でも解決が変わらないよう、両方とも `import.meta.dirname` で絶対パス化してからの参照に置き換える
- `@typescript/typescript6` は `vite-plugin-dts` 削除後、JS Compiler API を要求する依存が他に無いことを `pnpm why @typescript/typescript6` と `grep -rE '@typescript/typescript6'` で確認したうえで削除する（実行結果を PR 説明に残す）

## 完了条件

- 各パッケージのビルドが `vp pack` 経由で `.js` と `.d.ts` を出力し、`.js` は現行と同じパス、`.d.ts` は各 `package.json` の `exports["."].types` が指すパス（`dist/virtual_background.d.ts`、`dist/noise_suppression.d.ts`、`dist/mp4_media_stream.d.ts`、`dist/video_track_processor.d.ts`）に配置される
- `virtual-background` の現行ネスト出力 `dist/virtual-background/src/virtual_background.d.ts` が消え、代わりに `dist/virtual_background.d.ts` が出力される
- `packages/virtual-background/dist` に MediaPipe 資産（`*.tflite` / `*.binarypb` / `*.wasm` / `*wasm_bin.js`）が現行と同じレイアウトで出力される
- `vite-plugin-dts` と `@typescript/typescript6` への依存・import・設定がリポジトリから消えている（`vite-plugin-static-copy` は examples 側で継続利用するため残す）
- `vp run typecheck`、各パッケージの `vp pack`、examples の `vp build` がすべて成功する
- virtual-background / noise-suppression / mp4-media-stream のデモが従来どおり動作する（virtual-background は selfie_segmentation の wasm / tflite ロードが成功して背景合成が実行される、noise-suppression は音声処理後に音が通る、mp4-media-stream は各対応コーデックの再生ができる）
- lockfile が更新されている
- `CHANGES.md` の `## develop` `### misc` に `[CHANGE]` エントリで移行が記録されている

## 解決方法

1. 各パッケージの `vite.config.ts` に `pack` ブロックを追記し、`build.lib` + `rolldownOptions` の各要素と `dts()` / `viteStaticCopy()` の対象を「設計方針」の対応関係に従って `pack.*` 側へ写す。この段階では既存の `vite-plugin-dts` と `vite-plugin-static-copy` の import・`plugins:` 配列への登録・`build.*` 設定はまだ残す（`vp pack` は Vite プラグイン・`build` 設定を参照しないため、`vp build` を再実行しない限り副作用はない）
2. 各パッケージの `package.json` の `build` スクリプトを `vp pack` に切り替える（`mp4-media-stream` は `cargo build --release --target wasm32-unknown-unknown -p mp4_media_stream && vp pack` とし、Wasm の前段は維持する）
3. 各パッケージで `vp pack` を実行し、`dist` の内容（ファイル名・レイアウト・MediaPipe 資産・バンドル済み依存）が現行と一致することを確認する
4. examples を `vp build` し、alias 参照と `viteStaticCopy` が引き続き解決すること、3 デモが動作することを確認する
5. 各 `vite.config.ts` から旧 `build.lib` / `rolldownOptions` の設定と、`vite-plugin-dts` / `vite-plugin-static-copy` の import・`plugins:` 配列への登録を削除する（`vite-plugin-static-copy` は examples 側で継続利用するためルートの devDependency は残す）
6. ルート `package.json` から `vite-plugin-dts` を削除し、`@typescript/typescript6` の他用途を「設計方針」に記した手順で確認して削除する
7. `vp install` で lockfile を更新する
8. `CHANGES.md` の `## develop` `### misc` に `[CHANGE]` エントリを追加する
