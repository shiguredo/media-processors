const std = @import("std");
const math = std.math;
const ArrayList = std.ArrayList;
// var GBA = std.heap.GeneralPurposeAllocator(.{}){};
// const ALLOCATOR = GBA.allocator();
const expect = std.testing.expect;

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

    fn getRgb(self: Self, offset: usize) Rgb {
        return .{
            .r = self.data[offset],
            .g = self.data[offset + 1],
            .b = self.data[offset + 2],
        };
    }

    fn setRgb(self: Self, offset: usize, rgb: Rgb) void {
        self.data[offset] = rgb.r;
        self.data[offset + 1] = rgb.g;
        self.data[offset + 2] = rgb.b;
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
/// 「Efficient Contrast Enhancement Using Adaptive Gamma Correction With Weighting Distribution」論文がベース
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
        var i: usize = 0;
        while (i < image.data.len) : (i += 4) {
            const rgb = image.getRgb(i);
            var hsv = rgb.toHsv();
            hsv.v = self.mapping_curve[hsv.v];
            image.setRgb(i, hsv.toRgb());
        }
    }
};

// TODO: Sharpen

const Rgb = struct {
    r: u8,
    g: u8,
    b: u8,

    const Self = @This();

    // TODO: optimize
    fn toHsv(self: Self) Hsv {
        const r: usize = self.r;
        const g: usize = self.g;
        const b: usize = self.b;
        const max = @max(r, @max(g, b));
        const min = @min(r, @min(g, b));
        const n = max - min;

        const s = if (max == 0) 0 else n * 255 / max;
        const v = max;
        var h: usize = undefined;
        if (n == 0) {
            h = 0;
        } else if (max == r) {
            if (g < b) {
                h = (6 * 255) + (g * 255 / n) - (b * 255 / n);
            } else {
                h = (g - b) * 255 / n;
            }
        } else if (max == g) {
            h = 2 * 255 + b * 255 / n - r * 255 / n;
        } else {
            h = 4 * 255 + r * 255 / n - g * 255 / n;
        }
        h /= 6;

        return .{ .h = @truncate(u8, h), .s = @truncate(u8, s), .v = @truncate(u8, v) };
    }
};

const Hsv = struct {
    h: u8,
    s: u8,
    v: u8,

    const Self = @This();

    // TODO: optimize
    fn toRgb(self: Self) Rgb {
        if (self.s == 0) {
            return .{ .r = self.v, .g = self.v, .b = self.v };
        }

        var r: usize = self.v;
        var g: usize = self.v;
        var b: usize = self.v;
        const s: usize = self.s;
        const h6: usize = @intCast(usize, self.h) * 6;

        const f = h6 % 255;
        switch (h6 / 255) {
            1 => {
                r = r * (255 * 255 - s * f) / (255 * 255);
                b = b * (255 - s) / 255;
            },
            2 => {
                r = r * (255 - s) / 255;
                b = b * (255 * 255 - s * (255 - f)) / (255 * 255);
            },
            3 => {
                r = r * (255 - s) / 255;
                g = g * (255 * 255 - s * f) / (255 * 255);
            },
            4 => {
                r = r * (255 * 255 - s * (255 - f)) / (255 * 255);
                g = g * (255 - s) / 255;
            },
            5 => {
                g = g * (255 - s) / 255;
                b = b * (255 * 255 - s * f) / (255 * 255);
            },
            else => {
                g = g * (255 * 255 - s * (255 - f)) / (255 * 255);
                b = b * (255 - s) / 255;
            },
        }

        return .{ .r = @truncate(u8, r), .g = @truncate(u8, g), .b = @truncate(u8, b) };
    }
};

test "RGB to HSV to RGB" {
    const inputs = .{
        Rgb{ .r = 255, .g = 0, .b = 0 },
        Rgb{ .r = 10, .g = 30, .b = 200 },
        Rgb{ .r = 222, .g = 222, .b = 222 },
    };

    inline for (inputs) |original_rgb| {
        const hsv = original_rgb.toHsv();
        const rgb = hsv.toRgb();
        try expect(try math.absInt(@intCast(i9, rgb.r) - @intCast(i9, original_rgb.r)) <= 2);
        try expect(try math.absInt(@intCast(i9, rgb.g) - @intCast(i9, original_rgb.g)) <= 2);
        try expect(try math.absInt(@intCast(i9, rgb.b) - @intCast(i9, original_rgb.b)) <= 2);
    }
}
