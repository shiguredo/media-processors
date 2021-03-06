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
