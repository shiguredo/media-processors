#!/bin/bash

curl "https://s3.ap-northeast-2.wasabisys.com/pinto-model-zoo/370_Semantic-Guided-Low-Light-Image-Enhancement/resources.tar.gz" -o resources.tar.gz
tar -zxvf resources.tar.gz semantic_guided_llie_HxW.onnx semantic_guided_llie_720x1284.onnx
rm resources.tar.gz

echo Download finished.

docker run --rm -it \
  -v `pwd`:/workdir \
  -w /workdir \
  ghcr.io/pinto0309/onnx2tf:1.13.12 \
  onnx2tf -osd -i semantic_guided_llie_720x1284.onnx

if [ ! -d ".venv" ]; then
  python3 -m venv .venv
fi
. .venv/bin/activate
pip install tensorflowjs
tensorflowjs_converter \
  --input_format tf_saved_model \
  --output_format tfjs_graph_model \
  saved_model \
  tfjs_model
deactivate

echo Convert finished.
