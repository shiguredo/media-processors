#!/bin/bash

set -e

SG_LLIE_FILES="semantic_guided_llie_720x1284.onnx semantic_guided_llie_360x648.onnx semantic_guided_llie_480x648.onnx semantic_guided_llie_240x324.onnx"
SCI_FILES="sci_difficult_240x320.onnx sci_difficult_360x640.onnx sci_difficult_480x640.onnx sci_difficult_720x1280.onnx sci_easy_240x320.onnx sci_easy_360x640.onnx sci_easy_480x640.onnx sci_easy_720x1280.onnx sci_medium_240x320.onnx sci_medium_360x640.onnx sci_medium_480x640.onnx sci_medium_720x1280.onnx"
PMN_FILES="pmn_384x640.onnx pmn_480x640.onnx pmn_736x1280.onnx"

MODELS="${SG_LLIE_FILES//.onnx/} ${SCI_FILES//.onnx/} ${PMN_FILES//.onnx/}"

for f in $SG_LLIE_FILES; do
  if [ ! -e $f ]; then
    curl "https://s3.ap-northeast-2.wasabisys.com/pinto-model-zoo/370_Semantic-Guided-Low-Light-Image-Enhancement/resources.tar.gz" -o resources.tar.gz
    tar -zxvf resources.tar.gz $SG_LLIE_FILES
    rm resources.tar.gz
  fi
done

for f in $SCI_FILES; do
  if [ ! -e $f ]; then
    curl "https://s3.ap-northeast-2.wasabisys.com/pinto-model-zoo/286_SCI/resources.tar.gz" -o resources.tar.gz
    tar -zxvf resources.tar.gz $SCI_FILES
    rm resources.tar.gz
  fi
done

for f in $PMN_FILES; do
  if [ ! -e $f ]; then
    curl "https://s3.ap-northeast-2.wasabisys.com/pinto-model-zoo/349_PMN/resources.tar.gz" -o resources.tar.gz
    tar -zxvf resources.tar.gz $PMN_FILES
    rm resources.tar.gz
  fi
done

echo Download finished.

if [ ! -d ".venv" ]; then
  python3 -m venv .venv
fi
. .venv/bin/activate
pip install -r requirements.txt

for m in $MODELS; do
  if [ ! -d "tfjs_model_${m}" ]; then
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
  fi
done

deactivate

echo Convert finished.
