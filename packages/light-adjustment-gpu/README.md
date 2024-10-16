# @shiguredo/light-adjustment-gpu

[![npm version](https://badge.fury.io/js/@shiguredo%2Flight-adjustment-gpu.svg)](https://badge.fury.io/js/@shiguredo%2Flight-adjustment-gpu)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

ブラウザで映像のライト調整機能を実現するためのライブラリです。
@shiguredo/light-adjustment と違い GPU を利用して推論処理を行います。

光量が不足している画像のコントラストを改善したり、逆光で暗くなっている人物を明るくすることができます。
明るくする度合いの調整をすることができます。

## 使い方

### ブラウザから利用する場合

まずは script タグで JavaScript ファイルを読み込みます:
```html
<script src="https://cdn.jsdelivr.net/npm/@shiguredo/light-adjustment@latest/dist/light_adjustment-gpu.js"></script>
```

デフォルト設定でライト調整を行うコードは以下のようになります:
```html
<script>
    const assetsPath = "https://cdn.jsdelivr.net/npm/@shiguredo/light-adjustment-gpu@latest/dist";
    const model = Shiguredo.llieModelNames.semanticGuidedLlie1284x720; // モデル（処理する解像度）の指定
    const strength = 0.5; // 明るさの調整度合い
    const processor = new Shiguredo.LightAdjustmentGpuProcessor(assetsPath, model, streangth);

    navigator.mediaDevices.getUserMedia({video: true}).then((stream) => {
        const track = stream.getVideoTracks()[0];

        // 処理を開始
        processor.startProcessing(track).then((processed_track) => {
            const videoElement = document.getElementById("outputVideo"); // 映像の出力先を取得
            videoElement.srcObject = new MediaStream([processed_track]);
        });
    });
    ...

    // 処理を終了
    processor.stopProcessing();
</script>
```

実際の動作は[デモページ](https://shiguredo.github.io/media-processors/examples/light-adjustment-gpu/)（
[ソースコード](https://github.com/shiguredo/media-processors/blob/develop/examples/light-adjustment-gpu/main.mts)）で確認できます。


### JavaScript/TypeScript から利用する場合

以下のコマンドでパッケージがインストールできます:
```
$ npm install --save @shiguredo/light-adjustment-gpu
```

TypeScript での使用方法は次のようになります:
```typescript
import { LightAdjustmentGpuProcessor, llieModelNames } from "@shiguredo/light-adjustment";

const assetsPath = "https://cdn.jsdelivr.net/npm/@shiguredo/light-adjustment-gpu@latest/dist";
const model = llieModelNames.semanticGuidedLlie1284x720; // モデル（処理する解像度）の指定。
const strength = 0.5; // 明るさの調整度合い
const processor = new LightAdjustmentGpuProcessor();
const processed_video_track = await processor.startProcessing(original_video_track);

...

processor.stopProcessing();
```

入力解像度とモデル解像度が違う場合は、内部的に一度モデル解像度にリサイズして推論を行い、結果をリサイズして元の入力解像度に戻します。
モデル解像度が大きいほど処理負荷が大きくなります。

## サポートブラウザ

本ライブラリは Chrome や Edge 等の Chromium ベースのブラウザか Safari (15.4 以降)で動作します。
それぞれのブラウザでは、映像処理を効率的に行うために以下の機能を利用しています:
- **Chromium ベースブラウザ**: MediaStreamTrack Insertable Streams (aka Breakout Box)
- **Safari**: HTMLVideoElement.requestVideoFrameCallback メソッド

## ライセンス

[Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0)

```
Copyright 2023-2023, Yuusuke KOUNOIKE (Original Author)
Copyright 2023-2023, Shiguredo Inc.

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
[modelディレクトリのREADME](model/README.md) を参照してください:
```
- tfjs_model_semantic_guided_llie_<H>x<W>/gropu1-shard1of1.bin
- tfjs_model_semantic_guided_llie_<H>x<W>/model.json
```
