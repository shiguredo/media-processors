import { describe, expect, it } from "vitest";

import { VideoTrackProcessor } from "../src/video_track_processor.js";

// VideoTrackProcessor の公開 API が正しく読み込めることの最小限の確認
// 実際のメディア処理はブラウザ環境が必要なため、ここでは静的な振る舞いのみ検証する
describe("VideoTrackProcessor", () => {
  it("VideoTrackProcessor がエクスポートされている", () => {
    expect(VideoTrackProcessor).toBeDefined();
  });

  it("jsdom 環境で document が定義されている", () => {
    expect(typeof document).toBe("object");
  });

  it("isSupported() は boolean を返す", () => {
    const result = VideoTrackProcessor.isSupported();
    expect(typeof result).toBe("boolean");
  });
});
