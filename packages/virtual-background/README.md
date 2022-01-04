@shiguredo/virtual-background
=============================

JavaScript/TypeScriptで仮想背景機能を実現するためのライブラリです。

背景の画像の差し替えやぼかしを簡単に行うことができます。

なお、背景画像の切り出し部分には[@mediapipe/selfie_segmentation](https://www.npmjs.com/package/@mediapipe/selfie_segmentation)を利用しています。

インストールと使用例
--------------------

### JavaScript/TypeScriptから利用する場合

TODO: まだNPMに未登録なので以下は動作しない。

以下のコマンドでインストールが可能です:
```
npm install @shiguredo/virtual-background --save
```

コードでは、以下のようにimportしてください:
```typescript
import {VirtualBackgroundProcessor} from '@shiguredo/virtual-background';
```

### HTML(scriptタグ)で利用する場合

最初に[media-processor](../../)リポジトリのルートに移動して、プロジェクトをビルドする必要があります:
```console
$ git clone https://github.com/shiguredo/media-processors-private
$ cd media-processors-private/
$ npm install
$ npm run build


// 以下のディレクトリに、ビルド後のJavaScriptと必要なアセットが配置されています
// ※`assets/`ディレクトリは、今は存在しない（こんな感じになるかな、というイメージを書いているだけ）
$ ls packages/virtual-background/dist/
virtual_background.js

$ ls packages/virtual-background/assets/
selfie_segmentation.tflite           selfie_segmentation_solution_simd_wasm_bin.wasm
selfie_segmentation_landscape.tflite selfie_segmentation_solution_wasm_bin.wasm
```

ビルドが完了したら、以下のように以下のようにscriptタグから読み込んで使用することができます:
```html
<script src="path/to/virtual_background.js"></script>
```

ミニマムな使用例は以下のようになります:
```html
<script>
    const options = {blurRadius: 15};  // 背景ぼかし

    let processor;
    navigator.mediaDevices.getUserMedia({video: true}).then((stream) => {
        const track = stream.getVideoTracks()[0];
        processor = new window.Shiguredo.VirtualBackgroundProcessor(track, options);

        // 仮想背景処理開始
        processor.startProcessing().then((processed_track) => {
            // 処理後の`MediaStreamTrack`が得られたので、適当な処理を行う
            ...
        });
    });
    ...

    // 処理を終了
    processor.stopProcessing();
</script>
```

TODO: デモページへのリンクを貼る


サポートブラウザ
----------------

TODO: 使っている機能とか想定ブラウザ（e.g., Chrome）を書く。
