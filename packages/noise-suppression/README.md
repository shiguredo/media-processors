@shiguredo/noise-suppression
============================

JavaScript/TypeScriptでノイズ低減機能を実現するためのライブラリです。

雑音を抑制して、人の音声を聞き取りやすくすることができます。

なお、内部では[RNNoise](https://jmvalin.ca/demo/rnnoise/)を利用してノイズ低減を実現しています。

インストールと使用例
--------------------

### JavaScript/TypeScriptから利用する場合

TODO: まだNPMに未登録なので以下は動作しない。

以下のコマンドでインストールが可能です:
```
npm install @shiguredo/noise-suppression --save
```

コードでは、以下のようにimportしてください:
```typescript
import {NoiseSuppressionProcessor} from '@shiguredo/noise-suppression';
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
$ ls packages/noise-suppression/dist/
noise_suppression.js

$ ls packages/noise-suppression/assets/
rnnoise.wasm rnnoise-simd.wasm
```

ビルドが完了したら、以下のように以下のようにscriptタグから読み込んで使用することができます:
```html
<script src="path/to/noise_suppression.js"></script>
```

ミニマムな使用例は以下のようになります:
```html
<script>
    let processor;
    navigator.mediaDevices.getUserMedia({audio: true}).then((stream) => {
        const track = stream.getAudioTracks()[0];
        processor = new window.Shiguredo.NoiseSuppressionProcessor(track);

        // ノイズ低減処理開始
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
