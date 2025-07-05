# @shiguredo/noise-suppression

[![npm version](https://badge.fury.io/js/@shiguredo%2Fnoise-suppression.svg)](https://badge.fury.io/js/@shiguredo%2Fnoise-suppression)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

JavaScript/TypeScriptでノイズ抑制機能を実現するためのライブラリです。

雑音を抑制して、人の音声を聞き取りやすくすることができます。

なお、ノイズ抑制部分には [shiguredo/rnnoise-wasm](https://github.com/shiguredo/rnnoise-wasm) を使用しています。

## 使い方

```bash
pnpm add @shiguredo/noise-suppression
```

```typescript
import { NoiseSuppressionProcessor } from "@shiguredo/noise-suppression";

const processor = new Shiguredo.NoiseSuppressionProcessor();

// RNNoiseの推奨設定
const constraints = {
    sampleRate: {ideal: 48000},
    sampleSize: {ideal: 480},
    channelCount: {exact: 1}
}

navigator.mediaDevices.getUserMedia({audio: constraints}).then((stream) => {
    const track = stream.getAudioTracks()[0];

    // ノイズ抑制処理開始
    processor.startProcessing(track).then((processed_track) => {
        const audioElement = document.getElementById("outputAudio"); // 音声の出力先を取得
        audioElement.srcObject = new MediaStream([processed_track]);
    });
});
```

実際の動作は[デモページ](https://shiguredo.github.io/media-processors/noise-suppression/)（
[ソースコード](https://github.com/shiguredo/media-processors/blob/develop/examples/noise-suppression/main.ts)）で確認できます。

## サポートブラウザ

本ライブラリは MediaStreamTrack Insertable Streams (aka Breakout Box) というブラウザの機能を利用しています。そのため 2025 年 5 月現在では、Chrome や Edge 等の Chromium ベースのブラウザでのみ動作します。

## ライセンス

[Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0)

```text
Copyright 2022-2025, Takeru Ohta (Original Author)
Copyright 2022-2025, Shiguredo Inc.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
```

同梱されている RNNoise のライセンスについては
[rnnoise/COPYING](https://github.com/shiguredo/rnnoise/) を参照してください:
