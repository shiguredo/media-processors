import { ImageToImageVideoProcessor, ImageToImageModelOption } from "@shiguredo/image-to-image-video-processor";

/**
 * 使用するLLIEのモデル名
 * 現時点ではすべて SemanticGuidedLLIE なので、処理解像度のみの違い
 */
export enum llieModelNames {
  semanticGuidedLlie1284x720 = "semantic_guided_llie_1284x720",
  semanticGuidedLlie648x480 = "semantic_guided_llie_648x480",
  semanticGuidedLlie648x360 = "semantic_guided_llie_648x360",
  semanticGuidedLlie324x240 = "semantic_guided_llie_324x240",
}

const llieModels: { [key: string]: ImageToImageModelOption } = {
  semantic_guided_llie_1284x720: {
    modelPath: "tfjs_model_semantic_guided_llie_720x1284",
    inputWidth: 1284,
    inputHeight: 720,
    outputWidth: 1284,
    outputHeight: 720,
  },
  semantic_guided_llie_648x480: {
    modelPath: "tfjs_model_semantic_guided_llie_480x648",
    inputWidth: 648,
    inputHeight: 480,
    outputWidth: 648,
    outputHeight: 480,
  },
  semantic_guided_llie_648x360: {
    modelPath: "tfjs_model_semantic_guided_llie_360x648",
    inputWidth: 648,
    inputHeight: 360,
    outputWidth: 648,
    outputHeight: 360,
  },
  semantic_guided_llie_324x240: {
    modelPath: "tfjs_model_semantic_guided_llie_240x324",
    inputWidth: 648,
    inputHeight: 360,
    outputWidth: 648,
    outputHeight: 360,
  },
};

/**
 * GPU 推論を使って画像の明るさ補正を行うプロセッサークラス
 */
export class LightAdjustmentGpuProcessor extends ImageToImageVideoProcessor {
  /**
   * {@link LightAdjustmentGpuProcessor} インスタンスを生成します
   *
   * @param assetsPath tfjsのwasm 等のファイルの配置先ディレクトリパスないしURL
   * @param modelName {@link llieModelNames} のいずれか
   * @param strength 補正の強さ。0.0 から 1.0 の範囲で指定します
   */
  constructor(assetPath: string, modelName: llieModelNames, strength: number) {
    const model = llieModels[modelName];
    super(Object.assign({}, model, { modelPath: assetPath + model.modelPath }), strength);
  }
}
