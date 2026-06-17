import { Mp4MediaStream } from "../src/mp4_media_stream.js";

// Mp4MediaStream の公開 API が正しく読み込めることの最小限の確認
// 実際のメディア処理はブラウザ環境が必要なため、ここでは静的な振る舞いのみ検証する
describe("mp4 media stream", () => {
  it("エクスポートされている", () => {
    expect(Mp4MediaStream).toBeDefined();
  });

  it("isSupported() は boolean を返す", () => {
    expect(Mp4MediaStream.isSupported()).toBeTypeOf("boolean");
  });
});
