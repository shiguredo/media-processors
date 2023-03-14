const std = @import("std");
const ArrayList = std.ArrayList;
// var GBA = std.heap.GeneralPurposeAllocator(.{}){};
// const ALLOCATOR = GBA.allocator();

// RGBA
pub const Image = struct {
    data: ArrayList(u8),

    const Self = @This();

    pub fn init(data: ArrayList(u8)) !Self {
        if (data.len % 4 != 0) {
            return error.NotRgbaImageData;
        }
        return .{data};
    }

    pub fn deinit(self: Self) void {
        self.data.deinit();
    }
};

pub const AgcwdOptions = struct {
    /// 論文中に出てくる α パラメータ
    alpha: f32 = 0.5,
    //fusion: f32,
    //bottom_intensity: f32,
    //entropy_threshold: f32 = 0.05,
};

/// 画像の明るさ調整処理を行うための構造体
///
/// 「Efficient Contrast Enhancement Using Adaptive Gamma Correction With Weighting Distribution」論文をベースにしている
// TODO: オリジナルとの違いを書く
// - セグメンテーションマスク
// - 明るさの底上げ
// - fusion
pub const Agcwd = struct {
    options: AgcwdOptions,
    //entropy: f32,
    mapping_curve: [256]u8,

    const Self = @This();

    pub fn init(options: AgcwdOptions) Self {
        // updateState() が呼ばれるまでは入力画像と出力画像が一致するマッピングとなる
        // (実際には RGB <-> HSV 変換による誤差の影響によって微妙に変化する）
        var mapping_curve: [256]u8 = undefined;
        for (0..mapping_curve.len) |i| {
            mapping_curve[i] = i;
        }

        return .{ options, mapping_curve };
    }

    pub fn isStateObsolete(self: Self, image: Image) bool {
        _ = self;
        _ = image;
        return true;
    }

    pub fn updateState(self: *Self, image: Image, mask: ?Image) void {
        _ = self;
        _ = image;
        _ = mask;
    }

    pub fn enhanceImage(self: Self, image: *Image) void {
        _ = self;
        _ = image;
    }
};

// TODO: Sharpen
