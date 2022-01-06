# @shiguredo/noise-suppression

JavaScript/TypeScriptでノイズ抑制機能を実現するためのライブラリです。

雑音を抑制して、人の音声を聞き取りやすくすることができます。

なお、ノイズ抑制部分には [shiguredo/rnnoise-wasm](https://github.com/shiguredo/rnnoise-wasm) を使用しています。

## 使い方

### ブラウザから利用する場合

まずは script タグで JavaScript ファイルを読み込みます:
```html
<script src="https://cdn.jsdelivr.net/npm/@shiguredo/noise-suppression@latest/dist/noise_suppression.js"></script>
```

ノイズ抑制を行うコードは、以下のようになります:
```html
<script>
    // wasm ファイルの配置先
    const options = {
        assetsPath: "https://cdn.jsdelivr.net/npm/@shiguredo/noise-suppression@latest/dist/"
    };

    // RNNoiseの推奨設定
    const constraints = {
        sampleRate: {ideal: 48000},
        sampleSize: {ideal: 480},
        channelCount: {exact: 1}
    }

    let processor;
    navigator.mediaDevices.getUserMedia({audio: constraints}).then((stream) => {
        const track = stream.getAudioTracks()[0];
        processor = new Shiguredo.VirtualBackgroundProcessor(track, options);

        // ノイズ抑制処理開始
        processor.startProcessing().then((processed_track) => {
            const audioElement = document.getElementById("outputAudio"); // 音声の出力先を取得
            audioElement.srcObject = new MediaStream([processed_track]);
        });
    });
    ...

    // 処理を終了
    processor.stopProcessing();
</script>
```

実際の動作は[デモページ](https://shiguredo.github.io/media-processors/examples/noise-suppression.html)（
[ソースコード](https://github.com/shiguredo/media-processors/blob/develop/examples/noise-suppression.html)）で確認できます。

### JavaScript/TypeScript から利用する場合

以下のコマンドでパッケージがインストールできます:
```
$ npm install --save @shiguredo/noise-suppression
```

TypeScript での使用方法は次のようになります:
```typescript
import { NoiseSuppressionProcessor } from "@shiguredo/noise-suppression";

const processor = NoiseSuppressionProcessr(original_audio_track);
const processed_audio_track = await processor.startProcessing();

...

processor.stopProcessing();
```

## サポートブラウザ

本ライブラリは MediaStreamTrack Insertable Streams (aka Breakout Box) というブラウザの機能を利用しています。
そのため2022年1月現在では、ChromeやEdge等のChromiumベースのブラウザでのみ動作します。

## ライセンス

[Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0)

```
Copyright 2022-2022, Takeru Ohta (Original Author)
Copyright 2022-2022, Shiguredo Inc.

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

npm パッケージに同梱されている以下のファイルのライセンスについては
[rnnoise/COPYING](https://github.com/shiguredo/rnnoise/) を参照してください:
```
- rnnoise.wasm
- rnnoise-simd.wasm
```
