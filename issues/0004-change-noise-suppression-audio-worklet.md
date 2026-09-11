# noise-suppression の Breakout Box 依存をやめて Audio Worklet に切り替える

- Created: 2026-09-11
- Completed: {YYYY-MM-DD}
- Branch: feature/change-noise-suppression-audio-worklet
- Polished: {YYYY-MM-DD}

## 目的

Safari でも `NoiseSuppressionProcessor` を利用できるようにする。

現行実装は MediaStreamTrack Insertable Streams (Breakout Box) の `MediaStreamTrackProcessor` / `MediaStreamTrackGenerator` に依存している。Safari のメインスレッドにはこれらの API が公開されておらず、`NoiseSuppressionProcessor.isSupported()` が false になるためノイズ抑制を利用できない。音声処理を Audio Worklet に切り替え、Safari を含む主要ブラウザで動作するようにする。

## 現状

- `packages/noise-suppression/src/noise_suppression.ts` の `NoiseSuppressionProcessor.isSupported()` が `MediaStreamTrackProcessor` / `MediaStreamTrackGenerator` の存在を必須としている
- `packages/noise-suppression/src/noise_suppression.ts` の `TrackProcessor` が `MediaStreamTrackProcessor<AudioData>` の readable を `TransformStream` で RNNoise 処理し、`MediaStreamTrackGenerator` の writable に `pipeTo()` している
- RNNoise は 48 kHz / 480 フレーム / モノラルを前提とし、`TrackProcessor.transform()` が入力フレームを 480 フレーム単位にバッファリングして `DenoiseState.processFrame()` を呼んでいる
- `packages/noise-suppression/README.md` のサポートブラウザに「Breakout Box を利用しているため 2025 年 5 月現在では Chrome や Edge 等の Chromium ベースのみで動作する」と記載されている
- `examples/noise-suppression/` は `isSupported()` が false の環境で `Unsupported platform` の alert を出して起動しない

## 設計方針

- 音声処理を `AudioWorkletProcessor` に切り替える。AudioWorklet は Safari / Chrome / Edge / Firefox で利用できる
- 入出力は `AudioContext` の `MediaStreamAudioSourceNode` → `AudioWorkletNode` → `MediaStreamAudioDestinationNode` で構成し、`MediaStreamAudioDestinationNode.stream` の音声トラックを処理結果として返す
- AudioWorklet の render quantum は 128 フレーム固定のため、`AudioWorkletProcessor.process()` に渡される 128 フレームをリングバッファで 480 フレームに束ねてから RNNoise に渡す
- `isSupported()` は AudioWorklet の利用可否 (`AudioWorkletNode` と `AudioContext.audioWorklet` の存在) で判定する
- 公開 API (`startProcessing()` / `stopProcessing()` / `isProcessing()` / `getOriginalTrack()` / `getProcessedTrack()` / `isSupported()`) と引数・戻り値の型は維持する
- モノラルのみ対応し、複数チャンネルはエラーとする現行仕様を維持する
- Breakout Box 経路は残さず Audio Worklet 経路に一本化する。2 経路を並存させるとテストと保守が複雑になるため
- AudioWorklet モジュールは `packages/mp4-media-stream` と同じ方法で埋め込む。`src/` にワークレット実装を置き、`packages/noise-suppression/vite.config.ts` の transform フックでコード文字列としてバンドルに埋め込み、`URL.createObjectURL(new Blob([...]))` の URL を `audioContext.audioWorklet.addModule()` に渡す。追加の配布ファイルを増やさず、ライブラリ単体の `dist/*.js` で完結させる
- `stopProcessing()` で `AudioContext` を close し、リソースを解放する
- `jsdom` では AudioWorklet を実行できないため、パッケージのテストは公開 API の形状確認に留める。実処理の確認は `examples/noise-suppression/` で行う
- `packages/noise-suppression/README.md` のサポートブラウザと `CHANGES.md` の `## develop` を更新する

## 完了条件

- Safari で `NoiseSuppressionProcessor` が動作し、`examples/noise-suppression/` でノイズ抑制後の音声が再生できること
- Chrome / Edge でも従来どおり動作すること
- `isSupported()` が AudioWorklet の利用可否で判定されること
- 公開 API の互換性が維持されていること (非互換の変更が必要な場合は `CHANGES.md` に記載すること)
- 複数チャンネル入力時にエラーを送出する現行仕様が維持されていること
- `packages/noise-suppression/README.md` のサポートブラウザが更新されていること
- `vp run typecheck` / `vp run test` と examples のビルドが成功すること
