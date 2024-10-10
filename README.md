# Media Processors

![Static Badge](https://img.shields.io/badge/Checked_with-Biome-60a5fa?style=flat&logo=biome)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

仮想背景やノイズ抑制、ライト調整といったメディア処理をブラウザで簡単に行えるようにするためのライブラリです。

## About Shiguredo's open source software

We will not respond to PRs or issues that have not been discussed on Discord. Also, Discord is only available in Japanese.

Please read <https://github.com/shiguredo/oss/blob/master/README.en.md> before use.

## 時雨堂のオープンソースソフトウェアについて

利用前に <https://github.com/shiguredo/oss> をお読みください。

## 方針

対応ブラウザは最新の Chrome または Edge です。それ以外のブラウザでは動作しません。

ただし、以下の機能は Safari でも動作します。

- 仮想背景 / 背景ぼかし
- ライト調整
- ライト調整（GPU版）

## 機能

- [仮想背景 / 背景ぼかし](https://github.com/shiguredo/media-processors/tree/develop/packages/virtual-background)
- [ノイズ抑制](https://github.com/shiguredo/media-processors/tree/develop/packages/noise-suppression)
- [ライト調整](https://github.com/shiguredo/media-processors/tree/develop/packages/light-adjustment)
- [ライト調整（GPU版）](https://github.com/shiguredo/media-processors/tree/develop/packages/light-adjustment-gpu)

## npm

- [@shiguredo/virtual\-background \- npm](https://www.npmjs.com/package/@shiguredo/virtual-background)
- [@shiguredo/noise\-suppression \- npm](https://www.npmjs.com/package/@shiguredo/noise-suppression)
- [@shiguredo/light\-adjustment \- npm](https://www.npmjs.com/package/@shiguredo/light-adjustment)
- [@shiguredo/light\-adjustment\-gpu \- npm](https://www.npmjs.com/package/@shiguredo/light-adjustment-gpu)

## サンプル

GitHub Pages にサンプルを用意しています。完全にクライアントでのみ動作します。

- [仮想背景 / 背景ぼかし](https://shiguredo.github.io/media-processors/virtual-background/)
- [ノイズ抑制](https://shiguredo.github.io/media-processors/noise-suppression/)
- [ライト調整](https://shiguredo.github.io/media-processors/light-adjustment/)
- [ライト調整（GPU版）](https://shiguredo.github.io/media-processors/light-adjustment-gpu/)

## 優先実装

優先実装とは Sora のライセンスを契約頂いているお客様限定で Media Processors の実装予定機能を有償にて前倒しで実装することです。

### 優先実装が可能な機能一覧

**詳細は Discord やメールなどでお気軽にお問い合わせください**

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

```
Copyright 2022-2024, Takeru Ohta (Original Author)
Copyright 2022-2024, Shiguredo Inc.

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
