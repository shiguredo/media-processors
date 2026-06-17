/// <reference types="vite-plus/test/globals" />

import { VideoTrackProcessor } from "../src/video_track_processor.js";

// VideoTrackProcessor の公開 API が正しく読み込めることの最小限の確認
// 実際のメディア処理はブラウザ環境が必要なため、ここでは静的な振る舞いのみ検証する
describe("video track processor", () => {
  it("エクスポートされている", () => {
    expect(VideoTrackProcessor).toBeDefined();
  });

  it("jsdom 環境で document が定義されている", () => {
    expect(document).toBeTypeOf("object");
  });

  it("isSupported() は boolean を返す", () => {
    expect(VideoTrackProcessor.isSupported()).toBeTypeOf("boolean");
  });
});
