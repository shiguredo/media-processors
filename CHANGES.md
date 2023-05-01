# 変更履歴

- UPDATE
    - 下位互換がある変更
- ADD
    - 下位互換がある追加
- CHANGE
    - 下位互換のない変更
- FIX
    - バグ修正

## develop

- [UPDATE] GitHub Actions に Node 20 を追加
    - @voluntas

## virtual-background-2023.1.0

- [UPDATE] 複数の映像プロセッサを併用できるようにする
    - 現状では Chrome / Edge のみで対応
    - @sile
- [UPDATE] 映像トラック処理の共通部分を @shiguredo/video-track-processor として分離する
    - Chrome / Edge 用の Breakout Box と Safari 用の requestVideoFrameCallback を抽象化した汎用的な部分を切り出して、他の映像処理パッケージからも使えるようにする
    - @sile

## light-adjustment-2023.2.0

- [UPDATE] 複数の映像プロセッサを併用できるようにする
    - 現状では Chrome / Edge のみで対応
    - @sile

## light-adjustment-2023.1.0

**初リリース**

## virtual-background-2022.6.1
- [FIX] 仮想背景処理中の入力映像トラックの解像度変更に出力映像トラックが追従できていなかった問題を修正
    - https://github.com/shiguredo/media-processors/pull/170
    - @sile
- [FIX] iPhone で仮想背景処理が権限エラーで失敗する問題を修正
    - https://github.com/shiguredo/media-processors/pull/169
    - @sile

## virtual-background-2022.6.0
- [ADD] Safari での仮想背景処理に対応
    - Safari の 15.4 で `requestVideoFrameCallback()` が正式に対応されたため、それを用いて Safari での仮想背景処理に対応
    - Safari はキャンバスのフィルターによるぼかし機能に対応していないため、背景ぼかしは [StackBlur](https://github.com/flozz/StackBlur) を用いて実現している
    - https://github.com/shiguredo/media-processors/pull/160
    - @sile

## virtual-background-2022.5.0
- [CHANGE] 背景画像と処理対象映像のアスペクト比が異なる場合のデフォルト挙動を「引き伸ばし」から「中央部分のクロップ」に変更
    - https://github.com/shiguredo/media-processors/pull/129
    - @sile
- [ADD] 背景画像と処理対象映像のアスペクト比が異なる場合の処理方法を決定するための `backgroundImageRegion` オプションを追加
    - https://github.com/shiguredo/media-processors/pull/129
    - 合わせて、このオプションに指定可能な組み込みの関数を二つ提供:
      - `cropBackgroundImageCenter`: アスペクト比を維持したまま、背景画像の中央部分をクロップする（デフォルト）
      - `fillBackgroundImage`: アスペクト比を崩して、背景画像を処理対象映像に合わせて引き伸ばす（従来の挙動）
    - @sile
- [UPDATE] TypeScript のバージョンを 4.6.x から 4.7.x に更新
    - それに伴い `@types/dom-webcodecs` が不要となったので `dependencies` から削除
    - @sile

## virtual-background-2022.4.3
- [FIX] 仮想背景適用時に映像がチラつくことがある問題を修正
    - https://github.com/shiguredo/media-processors/pull/100
    - @sile

## noise-suppression-2022.4.2
- [FIX] `stopProcessing()`呼び出し前に、処理適用後のトラックを止めると警告やエラーログが出力される問題を修正
    - https://github.com/shiguredo/media-processors/pull/59
    - @sile

## virtual-background-2022.4.2
- [FIX] `stopProcessing()`呼び出し前に、処理適用後のトラックを止めると警告やエラーログが出力される問題を修正
    - https://github.com/shiguredo/media-processors/pull/59
    - @sile

## noise-suppression-2022.4.1
- [FIX] 公開APIに含まれる型を定義しているパッケージをdependenciesに追加
    - https://github.com/shiguredo/media-processors/pull/26
    - @sile

## virtual-background-2022.4.1
- [FIX] 公開APIに含まれる型を定義しているパッケージをdependenciesに追加
    - https://github.com/shiguredo/media-processors/pull/26
    - @sile

## noise-suppression-2022.4.0
- [ADD] RNNoiseモデルの差し替えに対応
    - https://github.com/shiguredo/media-processors/pull/15
    - @sile

- [ADD] 処理適用前後のメディアトラックを取得するためのAPIを追加
    - https://github.com/shiguredo/media-processors/pull/25
    - @sile

## virtual-background-2022.4.0
- [ADD] 処理適用前後のメディアトラックを取得するためのAPIを追加
    - https://github.com/shiguredo/media-processors/pull/25
    - @sile

## virtual-background-2022.3.1
- [FIX] 仮想背景適用時に画面がカクツクことがある問題を修正
    - https://github.com/shiguredo/media-processors/pull/14
    - @sile

## noise-suppression-2022.3.0
- [CHANGE] `NoiseSuppressionProcessors` のインタフェース見直し
    - 処理の開始・停止の度にインスタンスを作り直す必要がなくなった
    - https://github.com/shiguredo/media-processors/pull/12
    - @sile

## virtual-background-2022.3.0
- [CHANGE] `VirtualBackgroundProcessors` のインタフェース見直し
    - 処理の開始・停止の度にインスタンスの作り直す必要がなくなった
    - オプション指定タイミングをインスタンス生成時から処理開始時に移して、オプション変更を容易に行えるようにした
    - https://github.com/shiguredo/media-processors/pull/11
    - @sile

## noise-suppression-2022.2.0
- [UPDATE] 末尾にスラッシュを含む `assetsPath` をサポート
    - https://github.com/shiguredo/media-processors/pull/9
    - @sile
- [FIX] README.md 内の typo 修正
    - @sile

## virtual-background-2022.2.0
- [UPDATE] 末尾にスラッシュを含む `assetsPath` をサポート
    - https://github.com/shiguredo/media-processors/pull/9
    - @sile
- [FIX] README.md 内の typo 修正
    - @sile

## noise-suppression-2022.1.0

**初リリース**

## virtual-background-2022.1.0

**初リリース**
