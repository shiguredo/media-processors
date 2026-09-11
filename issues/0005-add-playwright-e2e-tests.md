# Playwright を利用した examples の E2E テストを追加する

- Created: 2026-09-11
- Completed: {YYYY-MM-DD}
- Branch: feature/add-playwright-e2e-tests
- Polished: {YYYY-MM-DD}

## 目的

examples のデモの動作を Playwright による E2E テストで自動検証し、ビルド・型検査・単体テストでは検出できない回帰を CI で検出できるようにする。

具体的には、MediaPipe / Wasm のロード失敗、映像・音声処理の停止、公開 API との接続不整合といった、実際にブラウザで動作させないと分からない問題を対象にする。

## 現状

- リポジトリに Playwright は導入されていない (`playwright.config.*` が存在せず、`package.json` にも依存がない)
- `.github/workflows/ci.yaml` は `vp run build` / `vp run lint` / `vp run typecheck` / `vp run test` のみを実行する
- `vp run test` は `vp run --filter './packages/*' test` で各パッケージの vitest を実行する。examples のテストは存在しない
- `examples/vite.config.ts` は index / mp4-media-stream / noise-suppression / virtual-background の 4 ページをビルドし、develop ブランチへの push で GitHub Pages にデプロイしている
- 各デモはブラウザのメディア機能に依存する
  - virtual-background: `getUserMedia` の映像トラックに仮想背景を適用する。MediaPipe の Wasm / tflite / binarypb のロードが前提
  - noise-suppression: `getUserMedia` の音声トラックにノイズ抑制を適用する
  - mp4-media-stream: `input[type=file]` で MP4 を選択して再生する
- 動作確認は手動で行われており、CI では検証されていない

## 設計方針

- E2E テストは Playwright を使う
- テストは `examples/e2e/` に置き、examples のビルド成果物を `vp preview` で配信して実行する (Playwright の `webServer` を利用する)
- production ビルドの `base` は `/media-processors/` のため、preview の URL は base を含めた形にする
- カメラ / マイクは Chromium の起動オプション `--use-fake-device-for-media-stream` / `--use-fake-ui-for-media-stream` で偽装し、実デバイスに依存させない
- `Unsupported platform` の alert を検出したらテストを失敗させる
- mp4-media-stream は `setInputFiles()` でテスト用の小さな MP4 を渡す。テスト用 MP4 は `examples/e2e/assets/` に置き、リポジトリサイズを抑えるため数十 KB 程度のものを使う
- 主要な検証観点は次のとおり
  - 各ページが `Unsupported platform` の alert を出さずにロードされること
  - noise-suppression: ノイズ抑制 ON の操作後、処理後の音声トラックが再生状態になること
  - virtual-background: 仮想背景 ON の操作後、MediaPipe のロードが完了して処理後映像が描画されること
  - mp4-media-stream: MP4 を選択して再生操作した後、`currentTime` が進むこと
- 対象ブラウザは Chromium のみとする。WebKit / Firefox への拡大は別 issue とする
- `examples/package.json` に `e2e` スクリプトを追加し、ルートからも実行できるようにする
- CI は `.github/workflows/ci.yaml` に E2E ジョブを追加する。Node.js の matrix (22 / 24 / 26) とは分離し、単一バージョンで `vp exec playwright install --with-deps chromium` を実行してからテストする
- 失敗時の調査に必要な trace のみを保存し、常時のスクリーンショット / ビデオ保存は行わない
- パッケージの処理ロジックの検証は各パッケージの vitest の責務のままとする

## 完了条件

- `examples/e2e/` の Playwright テストが追加され、ローカルでコマンド 1 つで実行できること
- ヘッドレス Chromium で 3 デモの主要動線が自動検証されること
- `.github/workflows/ci.yaml` で E2E テストが実行され、失敗時に CI が失敗すること
- 既存の `vp run build` / `lint` / `typecheck` / `test` の挙動が変わらないこと
- Playwright のバージョンが固定で依存に追加されていること
