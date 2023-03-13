const std = @import("std");
const testing = std.testing;

// TODO: オリジナルとの違いを書く
// - セグメンテーションマスク
// - 明るさの底上げ
// - fusion
pub const Agcwd = struct {
    alpha: f32,
    fusion: f32,
    bottom_intensity: f32,
    entropy: f32,
    entropy_threshold: f32,
    //mapping_curve: [256] u8 { 0 },
};

// TODO: Sharpen

// TODO: delete
export fn add(a: i32, b: i32) i32 {
    return a + b;
}

test "basic add functionality" {
    try testing.expect(add(3, 7) == 10);
}
