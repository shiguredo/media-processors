## モデルファイルのライセンスについて

利用しているモデルファイルは[PINTO_model_zoo](https://github.com/PINTO0309/PINTO_model_zoo/tree/main/370_Semantic-Guided-Low-Light-Image-Enhancement)よりダウンロードしたonnxをonxx2tf→tensorflowjs_converterでtfjs形式に変換したものです。
PINTO_model_zooの元となったモデルファイルは[Semantic-Guided-Low-Light-Image-Enhancement](https://github.com/ShenZheng2000/Semantic-Guided-Low-Light-Image-Enhancement)です。
PINTO_model_zooでの配布モデルファイル・元モデルファイルともにMITライセンスです。
tfjs形式に変換したモデルファイルもMITライセンスとします。

## モデルファイルのダウンロード・変換方法

download.shを実行するだけで自動的にダウンロード・変換が行われます。
ただし、x86_64環境のDocker利用を前提としています。
