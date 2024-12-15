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

### misc

- [CHANGE] GitHub Actions のビルド環境を ubuntu-latest から ubuntu-24.04 に変更する
  - @voluntas
- [CHANGE] tsconfig.json を共通化する
  - @voluntas
- [CHANGE] rollup を vite に置き換える
  - @voluntas

## mp4-media-stream-2024.3.0

- [ADD] `Mp4MediaStream` の対応コーデックに H.265 を追加する
  - @sile
- [ADD] `Mp4MediaStream` の対応コーデックに AV1 を追加する
  - @sile
- [ADD] `Mp4MediaStream` の対応コーデックに VP9 を追加する
  - @sile
- [ADD] `Mp4MediaStream` の対応コーデックに VP8 を追加する
  - @sile
- [ADD] `Mp4MediaStream` の対応コーデックに AAC を追加する
  - @sile

## mp4-media-stream-2024.2.0

- [CHANGE] `Mp4MediaStream.play()` を非同期にする
  - @sile
- [FIX] `Mp4MediaStream` が生成した `MediaStream` を WebRTC の入力とすると受信側で映像と音声のタイムスタンプが大幅にズレることがある問題を修正する
  - 以前は `MediaStreamTrackGenerator` を使って、映像および音声の出力先の `MediaTrack` を生成していた
    - ただし `MediaStreamTrackGenerator` に映像フレーム・音声データを書き込む際に指定するタイムスタンプを 0 始まりにすると、WebRTC を通した場合に映像と音声でのタイムスタンプが大幅（e.g., 数時間以上）にズレる問題が確認された
    - 実際に `MediaStreamTrackProcessor` が生成したタイムスタンプを確認したところ、0 始まりではなかったが、このタイムスタンプの基準値を外部から取得する簡単な方法はなさそうだった
      - 一度 `getUserMedia()` を呼び出してその結果を `MediaStreamTrackProcessor` に渡すことで取得できないことはないが現実的ではない
  - そのため、`MediaStreamTrackGenerator` は使うのは止めて、映像では `HTMLCanvasElement` を、音声では `AudioContext` を使って `MediaTrack` を生成するように変更した
  - @sile

## mp4-media-stream-2024.1.2

- [FIX] 音声のみの MP4 をロードした後に `Mp4MediaStream.play()` を呼び出すとエラーになる問題を修正する
  - @sile

## mp4-media-stream-2024.1.0

**初リリース**

## light-adjustment-2024.1.0

- [FIX] Zig の WebAssembly ビルドで addSharedLibrary から addBinary を使うよう変更になったので対応
  - <https://ziglang.org/documentation/master/#Freestanding>
  - <https://github.com/ziglang/zig/pull/17815>
  - @voluntas
- [FIX] zig で std.mem.copy ではなく @memcpy を使うようにする
  - <https://github.com/ziglang/zig/pull/18143>
  - @voluntas
- [FIX] Zig の組み込みのキャスト関数 xToY が yFromX にリネームされたので対応
  - @kounoike
- [FIX] Zig の `@truncate` やキャスト関連に破壊的変更があったため対応
  - @kounoike
- [CHANGE] examples のビルドを Vite を利用するようにする
  - @voluntas

## light-adjustment-gpu-2023.1.1

- [FIX] ライト調整 GPU 版の semantic_guided_llie_324x240 のパラメータが間違っていたのを修正
  - @kounoike
- [FIX] image-to-image-video-processor だけ TypeScript 5.2.2 に固定する
  - @voluntas

## light-adjustment-gpu-2023.1.0

**初リリース**

- [ADD] 推論ベースの Low-Light-Image-Enhancement を行う @shiguredo/light-adjustment-gpu パッケージを追加
  - 暗い画像に対してコントラストを改善したり、逆光で暗くなっている人物を明るくすることができる
  - 内部的には @shiguredo/image-to-image-video-processor を利用する
  - <https://github.com/PINTO0309/PINTO_model_zoo/tree/main/370_Semantic-Guided-Low-Light-Image-Enhancement> のモデルを tfjs に変換して使用する
  - @kounoike
- [ADD] 画像 → 画像の推論を行う際に使える @shiguredo/image-to-image-video-processor パッケージを追加する
  - Tensorflow.js を使い、画像 → 画像の何らかの推論を行う
  - 推論前後のリサイズ処理を入力解像度に合わせて自動的に行う
  - Low Light Image Enhancement のような明るさ補正、超解像、ノイズ除去などの推論で使われることを想定している
  - @kounoike
- [CHANGE] tsconfig.json の compilerOptions の lib を es2015 から es2020 に変更する
  - @voluntas
- [CHANGE] pnpm 化
  - pnpm-workspace に切り替え
  - @voluntas
- [UPDATE] engines でノードのバージョンを 18.17 以上にする
  - @voluntas
- [ADD] VideoTrackProcessor に平均処理時間・フレームレートを計算する機能を追加
  - @kounoike

## virtual-background-2023.2.0

- [UPDATE] CPU-GPU の転送を減らして背景ぼかし処理を高速化
  - @kounoike
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
  - <https://github.com/shiguredo/media-processors/pull/170>
  - @sile
- [FIX] iPhone で仮想背景処理が権限エラーで失敗する問題を修正
  - <https://github.com/shiguredo/media-processors/pull/169>
  - @sile

## virtual-background-2022.6.0

- [ADD] Safari での仮想背景処理に対応
  - Safari の 15.4 で `requestVideoFrameCallback()` が正式に対応されたため、それを用いて Safari での仮想背景処理に対応
  - Safari はキャンバスのフィルターによるぼかし機能に対応していないため、背景ぼかしは [StackBlur](https://github.com/flozz/StackBlur) を用いて実現している
  - <https://github.com/shiguredo/media-processors/pull/160>
  - @sile

## virtual-background-2022.5.0

- [CHANGE] 背景画像と処理対象映像のアスペクト比が異なる場合のデフォルト挙動を「引き伸ばし」から「中央部分のクロップ」に変更
  - <https://github.com/shiguredo/media-processors/pull/129>
  - @sile
- [ADD] 背景画像と処理対象映像のアスペクト比が異なる場合の処理方法を決定するための `backgroundImageRegion` オプションを追加
  - <https://github.com/shiguredo/media-processors/pull/129>
  - 合わせて、このオプションに指定可能な組み込みの関数を二つ提供:
    - `cropBackgroundImageCenter`: アスペクト比を維持したまま、背景画像の中央部分をクロップする（デフォルト）
    - `fillBackgroundImage`: アスペクト比を崩して、背景画像を処理対象映像に合わせて引き伸ばす（従来の挙動）
  - @sile
- [UPDATE] TypeScript のバージョンを 4.6.x から 4.7.x に更新
  - それに伴い `@types/dom-webcodecs` が不要となったので `dependencies` から削除
  - @sile

## virtual-background-2022.4.3

- [FIX] 仮想背景適用時に映像がチラつくことがある問題を修正
  - <https://github.com/shiguredo/media-processors/pull/100>
  - @sile

## noise-suppression-2022.4.2

- [FIX] `stopProcessing()`呼び出し前に、処理適用後のトラックを止めると警告やエラーログが出力される問題を修正
  - <https://github.com/shiguredo/media-processors/pull/59>
  - @sile

## virtual-background-2022.4.2

- [FIX] `stopProcessing()`呼び出し前に、処理適用後のトラックを止めると警告やエラーログが出力される問題を修正
  - <https://github.com/shiguredo/media-processors/pull/59>
  - @sile

## noise-suppression-2022.4.1

- [FIX] 公開 API に含まれる型を定義しているパッケージを dependencies に追加
  - <https://github.com/shiguredo/media-processors/pull/26>
  - @sile

## virtual-background-2022.4.1

- [FIX] 公開 API に含まれる型を定義しているパッケージを dependencies に追加
  - <https://github.com/shiguredo/media-processors/pull/26>
  - @sile

## noise-suppression-2022.4.0

- [ADD] RNNoise モデルの差し替えに対応

  - <https://github.com/shiguredo/media-processors/pull/15>
  - @sile

- [ADD] 処理適用前後のメディアトラックを取得するための API を追加
  - <https://github.com/shiguredo/media-processors/pull/25>
  - @sile

## virtual-background-2022.4.0

- [ADD] 処理適用前後のメディアトラックを取得するための API を追加
  - <https://github.com/shiguredo/media-processors/pull/25>
  - @sile

## virtual-background-2022.3.1

- [FIX] 仮想背景適用時に画面がカクツクことがある問題を修正
  - <https://github.com/shiguredo/media-processors/pull/14>
  - @sile

## noise-suppression-2022.3.0

- [CHANGE] `NoiseSuppressionProcessors` のインタフェース見直し
  - 処理の開始・停止の度にインスタンスを作り直す必要がなくなった
  - <https://github.com/shiguredo/media-processors/pull/12>
  - @sile

## virtual-background-2022.3.0

- [CHANGE] `VirtualBackgroundProcessors` のインタフェース見直し
  - 処理の開始・停止の度にインスタンスの作り直す必要がなくなった
  - オプション指定タイミングをインスタンス生成時から処理開始時に移して、オプション変更を容易に行えるようにした
  - <https://github.com/shiguredo/media-processors/pull/11>
  - @sile

## noise-suppression-2022.2.0

- [UPDATE] 末尾にスラッシュを含む `assetsPath` をサポート
  - <https://github.com/shiguredo/media-processors/pull/9>
  - @sile
- [FIX] README.md 内の typo 修正
  - @sile

## virtual-background-2022.2.0

- [UPDATE] 末尾にスラッシュを含む `assetsPath` をサポート
  - <https://github.com/shiguredo/media-processors/pull/9>
  - @sile
- [FIX] README.md 内の typo 修正
  - @sile

## noise-suppression-2022.1.0

**初リリース**

## virtual-background-2022.1.0

**初リリース**
