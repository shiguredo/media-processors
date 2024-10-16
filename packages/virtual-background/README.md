# @shiguredo/virtual-background

[![npm version](https://badge.fury.io/js/@shiguredo%2Fvirtual-background.svg)](https://badge.fury.io/js/@shiguredo%2Fvirtual-background)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

JavaScript/TypeScriptで仮想背景機能を実現するためのライブラリです。

背景の画像の差し替えやぼかしを簡単に行うことができます。

なお、背景画像の切り出し部分には[@mediapipe/selfie_segmentation](https://www.npmjs.com/package/@mediapipe/selfie_segmentation)を利用しています。

## 使い方

### ブラウザから利用する場合

まずは script タグで JavaScript ファイルを読み込みます:
```html
<script src="https://cdn.jsdelivr.net/npm/@shiguredo/virtual-background@latest/dist/virtual_background.js"></script>
```

背景ぼかしを行う場合は、以下のようなコードになります:
```html
<video id="outputVideo" autoplay></video>
<script>
    const assetsPath = "https://cdn.jsdelivr.net/npm/@shiguredo/virtual-background@latest/dist";
    const processor = new Shiguredo.VirtualBackgroundProcessor(assetsPath);

    navigator.mediaDevices.getUserMedia({video: true}).then((stream) => {
        const track = stream.getVideoTracks()[0];

        const options = {
            blurRadius: 15,  // 背景ぼかし設定
        };

        // 仮想背景処理開始
        processor.startProcessing(track, options).then((processed_track) => {
            const videoElement = document.getElementById("outputVideo"); // 映像の出力先を取得
            videoElement.srcObject = new MediaStream([processed_track]);
        });
    });
    ...

    // 処理を終了
    processor.stopProcessing();
</script>
```

ぼかすのではなく、背景画像を差し替えたい場合には、以下のようにオプションを指定してください:
```html
<script>
    const backgroundImage = new Image();
    backgroundImage.src = "/path/to/background-image";

    const options = {
        backgroundImage
    };
</script>
```

実際の動作は[デモページ](https://shiguredo.github.io/media-processors/virtual-background/)（
[ソースコード](https://github.com/shiguredo/media-processors/blob/develop/examples/virtual-background/main.mts)）で確認できます。


### JavaScript/TypeScript から利用する場合

以下のコマンドでパッケージがインストールできます:
```
$ npm install --save @shiguredo/virtual-background
```

TypeScript での使用方法は次のようになります:
```typescript
import { VirtualBackgroundProcessor } from "@shiguredo/virtual-background";

const assetsPath = "https://cdn.jsdelivr.net/npm/@shiguredo/virtual-background@latest/dist";
const processor = new VirtualBackgroundProcessor(assetsPath);

const options = {
    blurRadius: 15,  // 背景ぼかし設定
};
const processed_video_track = await processor.startProcessing(original_video_track, options);

...

processor.stopProcessing();
```

## サポートブラウザ

本ライブラリは Chrome や Edge 等の Chromium ベースのブラウザか Safari (15.4 以降）で動作します。
それぞれのブラウザでは、映像処理を効率的に行うために以下の機能を利用しています:
- **Chromium ベースブラウザ**: MediaStreamTrack Insertable Streams (aka Breakout Box)
- **Safari**: HTMLVideoElement.requestVideoFrameCallback メソッド

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
[@mediapipe/selfie_segmentation](https://www.npmjs.com/package/@mediapipe/selfie_segmentation) を参照してください:
```
- selfie_segmentation.binarypb
- selfie_segmentation_landscape.tflite
- selfie_segmentation_solution_simd_wasm_bin.wasm
- selfie_segmentation_solution_wasm_bin.wasm
- selfie_segmentation.tflite
- selfie_segmentation_solution_simd_wasm_bin.js
- selfie_segmentation_solution_wasm_bin.js
```
