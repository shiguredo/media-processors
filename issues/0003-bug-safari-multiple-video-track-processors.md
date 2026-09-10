# Safari で複数の映像トラックプロセッサを組み合わせられない

- Created: 2026-09-10
- Completed: {YYYY-MM-DD}
- Branch: feature/fix-safari-multiple-video-track-processors
- Polished: {YYYY-MM-DD}
- Reporter: @sile

## 目的

Safari でも複数の映像トラックプロセッサを組み合わせて適用できるようにする。

Chrome / Edge では Breakout Box 経路で複数のプロセッサを重ねて適用できるが、Safari では 2 段目以降のプロセッサが映像を取得できず、出力が真っ白になる。Safari 側の修正を待つのではなく、Media Processors 側の設計を修正してこの制限を解消する。

## 現状

### 事象

Safari で、あるプロセッサの出力トラックを別のプロセッサに渡して処理を重ねると、2 段目以降の出力が真っ白になる。2 段目の処理で `CanvasRenderingContext2D.drawImage()` を呼んでも何も描画されない状態になる。

- 2 段目の `HTMLVideoElement.requestVideoFrameCallback()` はフレーム更新ごとに呼ばれる
- 2 段目の `HTMLVideoElement` の `videoWidth` / `videoHeight` は正常な値を返す
- キャンバスを事前に単色で塗っておくとその色がそのまま残る（白が描画されている訳ではない）
- `srcObject` に 1 段目の出力トラックではなく元のカメラトラックを指定すると正常に動作する
- Chrome では同じ構成でも正常に動作する
- Safari 側の不具合の可能性が高い

### 原因

Safari では `MediaStreamTrackProcessor` / `MediaStreamTrackGenerator` がメインスレッドに公開されておらず、`VideoTrackProcessor.startProcessing()` が `RequestVideoFrameCallbackProcessor` 経路を選択する。

- `packages/video-track-processor/src/video_track_processor.ts` の `VideoTrackProcessor.startProcessing()`
  - `BreakoutBoxProcessor.isSupported()` が真なら `BreakoutBoxProcessor`、そうでなければ `RequestVideoFrameCallbackProcessor` を選択する
- `packages/video-track-processor/src/video_track_processor.ts` の `RequestVideoFrameCallbackProcessor`
  - 処理結果として `HTMLCanvasElement.captureStream()` が返すトラックを返す
  - 入力トラックは `HTMLVideoElement.srcObject` に設定し、`drawImage()` や MediaPipe への入力に使う
- 2 段目の `RequestVideoFrameCallbackProcessor` には 1 段目の `captureStream()` のトラックが入力されるため、2 段目の `HTMLVideoElement` に `captureStream()` のトラックを設定することになる。この構成では Safari の `drawImage()` が機能しない
- Chrome / Edge は `BreakoutBoxProcessor`（`MediaStreamTrackProcessor` / `MediaStreamTrackGenerator`）経由なので発生しない

`CHANGES.md` の `virtual-background-2023.1.0` には「複数の映像プロセッサを併用できるようにする」「現状では Chrome / Edge のみで対応」と記載されており、Safari は複数プロセッサの併用が対象外になっている。

### 再現手順

`VirtualBackgroundProcessor` を 2 つ使って同じトラックに処理を 2 回適用する。`assetsPath` と `options` は実際の値に置き換える。

```ts
import { VirtualBackgroundProcessor } from "@shiguredo/virtual-background";

const stream = await navigator.mediaDevices.getUserMedia({ video: true });
const originalTrack = stream.getVideoTracks()[0];

const processor1 = new VirtualBackgroundProcessor(assetsPath);
const processedTrack1 = await processor1.startProcessing(originalTrack, options);

const processor2 = new VirtualBackgroundProcessor(assetsPath);
// Safari では processedTrack2 が真っ白になる
const processedTrack2 = await processor2.startProcessing(processedTrack1, options);
```

MediaPipe を使わず、キャンバスの `captureStream()` を 2 段重ねるだけでも再現する。

```ts
// 1 段目: カメラトラックをキャンバスに転写し、その captureStream() のトラックを作る
const canvas1 = document.createElement("canvas");
canvas1.width = width;
canvas1.height = height;
const canvasCtx1 = canvas1.getContext("2d");
const video1 = document.createElement("video");
video1.muted = true;
video1.playsInline = true;
video1.srcObject = new MediaStream([originalTrack]);
video1.requestVideoFrameCallback(function callback() {
  canvasCtx1.drawImage(video1, 0, 0);
  video1.requestVideoFrameCallback(callback);
});
await video1.play();
const stream1 = canvas1.captureStream();

// 2 段目: stream1 のトラックを別のキャンバスに転写する
const canvas2 = document.createElement("canvas");
canvas2.width = width;
canvas2.height = height;
const canvasCtx2 = canvas2.getContext("2d");
const video2 = document.createElement("video");
video2.muted = true;
video2.playsInline = true;
video2.srcObject = stream1;
video2.requestVideoFrameCallback(function callback() {
  // Safari ではここで何も描画されない
  canvasCtx2.drawImage(video2, 0, 0);
  video2.requestVideoFrameCallback(callback);
});
await video2.play();
```

## 設計方針

- Safari の修正を待たず、Media Processors 側で対応する
- 処理を複数適用する場合でも `captureStream()` の呼び出しが最初の 1 回だけになるようにする
- プロセッサ間は映像トラックではなく画像データ（`VideoFrame` / `ImageBitmap` 等）として受け渡す
- 具体的な API 形状は実装時に決定する。既存の `startProcessing(track): Promise<track>` を維持して内部で複数処理を連鎖させるか、パイプラインとして再設計するかを公開 API の互換性も含めて判断する

## 完了条件

- Safari で `VirtualBackgroundProcessor` などの映像トラックプロセッサを 2 段以上適用しても、2 段目以降が正常に映像を処理できること
- `captureStream()` の呼び出しが処理全体で 1 回だけになること
- Chrome / Edge の既存の動作が変わらないこと
- 公開 API を変更する場合は後方互換のない変更として `CHANGES.md` に記載すること
