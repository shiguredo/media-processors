# Media Processors

[![npm @shiguredo/virtual-background](https://badge.fury.io/js/@shiguredo%2Fvirtual-background.svg)](https://www.npmjs.com/package/@shiguredo/virtual-background)
[![npm @shiguredo/noise-suppression](https://badge.fury.io/js/@shiguredo%2Fnoise-suppression.svg)](https://www.npmjs.com/package/@shiguredo/noise-suppression)
[![npm @shiguredo/mp4-media-stream](https://badge.fury.io/js/@shiguredo%2Fmp4-media-stream.svg)](https://www.npmjs.com/package/@shiguredo/mp4-media-stream)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![GitHub Actions](https://github.com/shiguredo/media-processors/actions/workflows/ci.yaml/badge.svg)](https://github.com/shiguredo/media-processors/actions/workflows/ci.yaml)
[![Discord](https://img.shields.io/badge/Discord-%235865F2.svg?logo=discord&logoColor=white)](https://discord.gg/shiguredo)

仮想背景やノイズ抑制、MP4 メディアストリームといったメディア処理をブラウザで簡単に行えるようにするためのライブラリです。

## About Shiguredo's open source software

We will not respond to PRs or issues that have not been discussed on Discord. Also, Discord is only available in Japanese.

Please read <https://github.com/shiguredo/oss/blob/master/README.en.md> before use.

## 時雨堂のオープンソースソフトウェアについて

利用前に <https://github.com/shiguredo/oss> をお読みください。

## 方針

対応ブラウザは最新の Chrome または Edge です。それ以外のブラウザでは動作しません。

ただし、以下の機能は Safari でも動作します。

- 仮想背景 / 背景ぼかし

## 機能

- [仮想背景 / 背景ぼかし](https://github.com/shiguredo/media-processors/tree/develop/packages/virtual-background)
- [ノイズ抑制](https://github.com/shiguredo/media-processors/tree/develop/packages/noise-suppression)
- [MP4 メディアストリーム](https://github.com/shiguredo/media-processors/tree/develop/packages/mp4-media-stream)

## npm

- [@shiguredo/virtual\-background \- npm](https://www.npmjs.com/package/@shiguredo/virtual-background)
- [@shiguredo/noise\-suppression \- npm](https://www.npmjs.com/package/@shiguredo/noise-suppression)
- [@shiguredo/mp4\-media\-stream \- npm](https://www.npmjs.com/package/@shiguredo/mp4-media-stream)

## サンプル

GitHub Pages にサンプルを用意しています。完全にクライアントでのみ動作します。

- [仮想背景 / 背景ぼかし](https://shiguredo.github.io/media-processors/virtual-background/)
- [ノイズ抑制](https://shiguredo.github.io/media-processors/noise-suppression/)
- [MP4 メディアストリーム](https://shiguredo.github.io/media-processors/mp4-media-stream/)

## 優先実装

優先実装とは Sora のライセンスを契約頂いているお客様限定で Media Processors の実装予定機能を有償にて前倒しで実装することです。

### 優先実装が可能な機能一覧

**詳細は Discord やメールなどでお気軽にお問い合わせください**

- シャープネス
- フェイスフレーミング

すでに存在するライブラリや仕組みを利用する前提となります。

## サポートについて

### Discord

- サポートしません
- アドバイスします
- フィードバック歓迎します

最新の状況などは Discord で共有しています。質問や相談も Discord でのみ受け付けています。

<https://discord.gg/shiguredo> の `#media-processors` チャネルをご利用ください。

### バグ報告

Discord へお願いします。

## ライセンス

[Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0)

```text
Copyright 2022-2026, Takeru Ohta (Original Author)
Copyright 2022-2026, Shiguredo Inc.

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
