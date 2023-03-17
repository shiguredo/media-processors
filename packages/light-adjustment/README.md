# @shiguredo/light-adjustment

[![npm version](https://badge.fury.io/js/@shiguredo%2Flight-adjustment.svg)](https://badge.fury.io/js/@shiguredo%2Flight-adjustment)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

TODO

## サポートブラウザ

本ライブラリは Chrome や Edge 等の Chromium ベースのブラウザか Safari (15.4 以降）で動作します。
それぞれのブラウザでは、映像処理を効率的に行うために以下の機能を利用しています:
- **Chromium ベースブラウザ**: MediaStreamTrack Insertable Streams (aka Breakout Box)
- **Safari**: HTMLVideoElement.requestVideoFrameCallback メソッド

## ライセンス

[Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0)

```
Copyright 2023-2023, Takeru Ohta (Original Author)
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
