# @shiguredo/mp4-media-stream

[![npm version](https://badge.fury.io/js/@shiguredo%2Fmp4-media-stream.svg)](https://badge.fury.io/js/@shiguredo%2Fmp4-media-stream)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

ファイルや URL から取得した MP4 データから MediaStream を作成するためのライブラリです。

## 使い方

```typescript
import { Mp4MediaStream } from '@shiguredo/mp4-media-stream'

// ファイルなどから取得した MP4 データを読み込む
const mp4MediaStream = await Mp4MediaStream.load(mp4FileBlob)

// 指定の MP4 を再生するための MediaStream を作成する
const stream = mp4MediaStream.play(options)

// Video 要素の入力に作成された MediaStream を設定する
const video = document.getElementById('video')
video.srcObject = stream
```

実際の動作は[デモページ](https://shiguredo.github.io/media-processors/mp4-media-stream/)（
[ソースコード](https://github.com/shiguredo/media-processors/blob/develop/examples/mp4-media-stream/main.mts)）で確認できます。

## サポートブラウザ

本ライブラリは Chrome や Edge 等の Chromium ベースのブラウザで動作します。

## 対応コーデック

- 映像:
  - H.264
  - VP8
- 音声:
  - AAC
  - Opus

## 未対応機能

以下の機能には現時点では対応していません:
- 再生開始位置の指定（シーク）
- 再生の一時停止・再開
- 数 GB を超える MP4 ファイルの再生
- MP4 の edts ボックスのハンドリング（edts を使ってリップシンクが調整されている場合には再生時にズレる可能性がある）
- B フレームが有効になっている H.264 ストリーム（映像の再生順序が正しくならない可能性がある）

## ライセンス

[Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0)

```
Copyright 2024-2024, Takeru Ohta (Original Author)
Copyright 2024-2024, Shiguredo Inc.

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
