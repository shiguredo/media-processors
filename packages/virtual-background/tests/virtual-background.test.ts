import { VirtualBackgroundProcessor } from "../src/virtual_background.js";

// VirtualBackgroundProcessor の公開 API が正しく読み込めることの最小限の確認
// 実際のメディア処理はブラウザ環境が必要なため、ここでは静的な振る舞いのみ検証する
describe("virtual background", () => {
  it("エクスポートされている", () => {
    expect(VirtualBackgroundProcessor).toBeDefined();
  });

  it("isSupported() は boolean を返す", () => {
    expect(VirtualBackgroundProcessor.isSupported()).toBeTypeOf("boolean");
  });
});
