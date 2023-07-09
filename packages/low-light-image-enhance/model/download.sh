#!/bin/bash

set -e

curl "https://s3.ap-northeast-2.wasabisys.com/pinto-model-zoo/370_Semantic-Guided-Low-Light-Image-Enhancement/resources.tar.gz" -o resources.tar.gz
tar -zxvf resources.tar.gz semantic_guided_llie_720x1284.onnx semantic_guided_llie_360x648.onnx semantic_guided_llie_480x648.onnx semantic_guided_llie_240x324.onnx
rm resources.tar.gz

echo Download finished.

if [ ! -d ".venv" ]; then
  python3 -m venv .venv
fi
. .venv/bin/activate
pip install -r requirements.txt

for m in semantic_guided_llie_720x1284 semantic_guided_llie_360x648 semantic_guided_llie_480x648 semantic_guided_llie_240x324; do
  docker run --rm -it \
    -v `pwd`:/workdir \
    -w /workdir \
    ghcr.io/pinto0309/onnx2tf:1.13.12 \
    onnx2tf -osd -i ${m}.onnx -o saved_model_${m}

  tensorflowjs_converter \
    --input_format tf_saved_model \
    --output_format tfjs_graph_model \
    saved_model_${m} \
    tfjs_model_${m}
done

deactivate

echo Convert finished.
