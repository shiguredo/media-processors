import { NoiseSuppressionProcessor } from "../src/noise_suppression.js";

// NoiseSuppressionProcessor の公開 API が正しく読み込めることの最小限の確認
// 実際のメディア処理はブラウザ環境が必要なため、ここでは静的な振る舞いのみ検証する
describe("noise suppression", () => {
  it("エクスポートされている", () => {
    expect(NoiseSuppressionProcessor).toBeDefined();
  });

  it("isSupported() は boolean を返す", () => {
    expect(NoiseSuppressionProcessor.isSupported()).toBeTypeOf("boolean");
  });
});
