const std = @import("std");
const math = std.math;
const ArrayList = std.ArrayList;
const Allocator = std.mem.Allocator;
const expect = std.testing.expect;
const test_allocator = std.testing.allocator;

/// 明るさ調整用のオプション群。
pub const LightAdjustmentOptions = struct {
    /// AGCWD の論文中に出てくる α パラメータ。
    ///
    /// この値が大きいほどコントラストが強調される傾向がある。
    alpha: f32 = 0.5,

    /// AGCWD の論文中に出てくる映像のフレーム間の差異を検知する際の閾値。
    ///
    /// 新しいフレームが以前のものと差異がある、と判定された場合には、
    /// 明るさ調整用のテーブルが更新されることになる。
    ///
    /// 値が小さくなるほど、微細な変化でテーブルが更新されるようになるため、
    /// より適切な調整が行われやすくなるが、その分処理負荷は高くなる可能性がある。
    ///
    /// 0 以下の場合には毎フレームで更新されるようになる。
    entropy_threshold: f32 = 0.05,

    /// 処理後の画像の最低の明るさ (HSV の V の値）。
    min_intensity: u8 = 10,

    /// 処理後の画像の最大の明るさ (HSV の V の値）。
    max_intensity: u8 = 255,

    /// 明るさ調整処理の度合い。
    ///
    /// AGCWD による明るさ調整処理適用前後の画像の混合割合（パーセンテージ）で、
    /// 0 なら処理適用前の画像が、100 なら処理適用後の画像が、50 ならそれらの半々が、採用されることになる。
    adjustment_level: u8 = 50,

    /// 明るさ調整後に画像に適用するシャープネス処理の度合い。
    ///
    /// シャープネス処理適用前後の画像の混合割合（パーセンテージ）で、
    /// 0 なら処理適用前の画像が、100 なら処理適用後の画像が、50 ならそれらの半々が、採用されることになる。
    sharpness_level: u8 = 20,
};

/// 明るさ調整を行うための構造体。
///
/// 明るさ調整は「Efficient Contrast Enhancement Using Adaptive Gamma Correction With Weighting Distribution」論文がベース。
/// 明るさ調整後には deconvolution filter に基づくシャープネス処理を適用する。
pub const LightAdjustment = struct {
    const Self = @This();

    options: LightAdjustmentOptions,
    agcwd: Agcwd,
    sharpener: Sharpener,
    image: RgbaImage,
    mask: FocusMask,

    pub fn init(allocator: Allocator, width: u32, height: u32) !Self {
        const image = try RgbaImage.init(allocator, width, height);
        errdefer image.deinit();

        const mask = try FocusMask.init(allocator, width, height);
        errdefer mask.deinit();

        unreachable;
    }

    pub fn deinit(self: *const Self) void {
        self.image.deinit();
        self.mask.deinit();
    }

    pub fn isStateObsolete(self: *const Self) bool {
        _ = self;
        unreachable;
    }

    pub fn updateState(self: *Self) void {
        _ = self;
    }

    pub fn processImage(self: *Self) void {
        _ = self;
    }

    pub fn resize(self: *Self, width: u32, height: u32) !void {
        self.deinit();

        const image = try RgbaImage.init(self.image.allocator, width, height);
        errdefer image.deinit();

        const mask = try FocusMask.init(self.mask.allocator, width, height);
        errdefer mask.deinit();

        unreachable;
    }

    pub fn getImageData(self: *Self) []u8 {
        return self.image.data;
    }

    pub fn getMaskData(self: *Self) []u8 {
        return self.mask.data;
    }
};

/// AGCWD で明るさ調整を行う際に、画像のどの部分を基準に調整するかを指定するための構造体。
///
/// これによって「逆光時に画像全体ではなく人物部分の明るさを改善するように指定する」といったことが可能になる。
/// なお、このマスクの値によらず、明るさ調整処理自体は常に画像全体に対して適用される（その適用のされ方が変わるだけ）。
const FocusMask = struct {
    const Self = @This();

    /// 画像の各ピクセルの重み。
    /// 0 ならそのピクセルは無視され、値が大きくなるほど明るさ調整の際に重視されるようになる。
    data: []u8,

    allocator: Allocator,

    fn init(allocator: Allocator, width: u32, height: u32) !Self {
        const data = try allocator.alloc(u8, width * height);
        return .{ .data = data, .allocator = allocator };
    }

    fn deinit(self: Self) void {
        self.allocator.free(self.data);
    }
};

/// 処理対象の画像データを格納するための構造体。
const RgbaImage = struct {
    const Self = @This();

    /// RGBA 形式のピクセル列。
    data: []u8,

    allocator: Allocator,

    fn init(allocator: Allocator, width: u32, height: u32) !Self {
        const data = try allocator.alloc(u8, width * height * 4);
        return .{ .data = data, .allocator = allocator };
    }

    fn deinit(self: Self) void {
        self.allocator.free(self.data);
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

const Rgb = struct {
    const Self = @This();

    r: u8,
    g: u8,
    b: u8,

    fn intensity(self: Self) u8 {
        return @max(self.r, @max(self.g, self.b));
    }
};

/// AGCWD アルゴリズムに基づいて画像の明るさ調整処理を行うための構造体。
///
/// 論文: Efficient Contrast Enhancement Using Adaptive Gamma Correction With Weighting Distribution
const Agcwd = struct {
    const Self = @This();

    /// 明るさ調整用の変換テーブル。
    /// 形式: `table[変換前（ピクセル）の intensity][変換後の R or G or B 値] = 変換後の R or G or B 値`
    table: [256][256]u8,

    /// テーブルの更新が必要かどうかの判定に使われる画像のエントロピー値。
    entropy: f32 = -1.0,

    fn init() Self {
        // updateState() が呼ばれるまでは入力画像と出力画像が一致するマッピングとなる
        var table: [256][256]u8 = undefined;
        for (0..table.len) |i| {
            for (0..i + 1) |j| {
                table[i][j] = @truncate(u8, j);
            }
        }
        return .{ .table = table };
    }

    fn isStateObsolete(self: *const Self, image: *const Image, options: *const LightAdjustmentOptions) bool {
        const pdf = Pdf.fromImage(image);
        const entropy = pdf.entropy();
        return @fabs(self.entropy - entropy) > options.entropy_threshold;
    }

    fn updateState(self: *Self, image: *const Image, mask: *const Mask, options: *const LightAdjustmentOptions) void {
        // エントロピーは画像全体から求める
        var pdf = Pdf.fromImage(image);
        self.entropy = pdf.entropy();

        // 明るさ変換に使うテーブルはマスク領域だけから求める
        pdf = Pdf.fromImageAndMask(image, mask);
        const cdf = Cdf.fromPdf(&pdf.toWeightingDistribution(options.alpha));
        const mapping_curve = cdf.toIntensityMappingCurve(options);
        for (0..mapping_curve.len) |intensity| {
            const processed_intensity = @intCast(u16, mapping_curve[intensity]);
            for (0..intensity) |pixel_value| {
                self.table[intensity][pixel_value] = @truncate(u8, pixel_value * processed_intensity / intensity);
            }
            self.table[intensity][intensity] = @truncate(u8, processed_intensity);
        }
    }

    fn processImage(self: *const Self, image: *Image) void {
        var i: usize = 0;
        while (i < image.data.len) : (i += 4) {
            var rgb = image.getRgb(i);
            const v = rgb.intensity();
            rgb.r = self.table[v][rgb.r];
            rgb.g = self.table[v][rgb.g];
            rgb.b = self.table[v][rgb.b];
            image.setRgb(i, rgb);
        }
    }
};

pub const Mask = struct {
    data: []u8,

    allocator: ?Allocator = null,

    const Self = @This();

    pub fn deinit(self: Self) void {
        if (self.allocator) |allocator| {
            allocator.free(self.data);
        }
    }
};

// RGBA
pub const Image = struct {
    width: u32,
    height: u32,
    data: []u8,
    allocator: ?Allocator = null,

    const Self = @This();

    pub fn fromSlice(width: u32, height: u32, data: []u8) !Self {
        if (width * height * 4 != data.len) {
            return error.NotRgbaImageData;
        }
        return .{ .width = width, .height = height, .data = data };
    }

    pub fn deinit(self: Self) void {
        if (self.allocator) |allocator| {
            allocator.free(self.data);
        }
    }

    pub fn clone(self: Self) !Self {
        const allocator = self.allocator orelse std.heap.page_allocator;
        const data = try allocator.alloc(u8, self.data.len);
        errdefer allocator.free(data);
        std.mem.copy(u8, data, self.data);
        return .{
            .width = self.width,
            .height = self.height,
            .data = data,
            .allocator = allocator,
        };
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

/// Probability Density Function.
const Pdf = struct {
    const Self = @This();

    table: [256]f32,

    fn fromImage(image: RgbaImage) Self {
        return Self.fromImageAndMask(image, null);
    }

    fn fromImageAndMask(image: RgbaImage, mask: ?FocusMask) Self {
        var histogram = [_]usize{0} ** 256;
        var total: usize = 0;
        {
            var i: usize = 0;
            while (i < image.data.len) : (i += 4) {
                const weight = if (mask) |non_null_mask| non_null_mask.data[i / 4] else 255;
                histogram[image.getRgb(i).intensity()] += weight;
                total += weight;
            }
        }

        var table: [256]f32 = undefined;
        if (total > 0) {
            const n = @intToFloat(f32, total);

            for (histogram, 0..) |weight, i| {
                table[i] = @intToFloat(f32, weight) / n;
            }
        }

        return .{ .table = table };
    }

    fn entropy(self: *const Self) f32 {
        var sum: f32 = 0;
        for (self.table) |intensity| {
            if (intensity > 0.0) {
                sum += intensity * @log(intensity);
            }
        }
        return -sum;
    }

    fn toWeightingDistribution(self: *const Self, alpha: f32) Self {
        var max_intensity = self.table[0];
        var min_intensity = self.table[0];
        for (self.table) |intensity| {
            max_intensity = @max(max_intensity, intensity);
            min_intensity = @min(min_intensity, intensity);
        }

        var table: [256]f32 = undefined;
        const range = max_intensity - min_intensity + math.floatEps(f32);

        for (self.table, 0..) |x, i| {
            table[i] = max_intensity * math.pow(f32, ((x - min_intensity) / range), alpha);
        }

        return .{ .table = table };
    }
};

/// Cumulative Distribution Function.
const Cdf = struct {
    const Self = @This();

    table: [256]f32,

    fn fromPdf(pdf: *const Pdf) Self {
        var sum: f32 = 0.0;
        for (pdf.table) |intensity| {
            sum += intensity;
        }

        var table: [256]f32 = undefined;
        var acc: f32 = 0.0;
        for (pdf.table, 0..) |intensity, i| {
            acc += intensity;
            table[i] = acc / sum;
        }

        return .{ .table = table };
    }

    fn toIntensityMappingCurve(self: *const Self, options: LightAdjustmentOptions) [256]u8 {
        var curve: [256]u8 = undefined;
        const min: f32 = @intToFloat(f32, options.min_intensity);
        const max: f32 = @intToFloat(f32, options.max_intensity);
        const range: f32 = @max(0.0, max - min);
        const ratio = @intToFloat(f32, options.adjustment_level) / 100.0;

        for (self.table, 0..) |gamma, i| {
            const v0: f32 = @intToFloat(f32, i);
            const v1: f32 = range * math.pow(f32, v0 / 255.0, 1.0 - gamma) + min;
            curve[i] = @floatToInt(u8, math.round(v0 * (1.0 - ratio) + v1 * ratio));
        }
        return curve;
    }
};

const Sharpener = struct {
    buf: Image,
};

// // TODO: optimize
// fn sharpen(image: *Image, level: u8) !void {
//     const filter = [_]i8{ 0, -1, 0, -1, 5, -1, 0, -1, 0 };

//     const original_image = try image.clone();
//     defer original_image.deinit();

//     const original_data = original_image.data;
//     const processed_data = image.data;

//     for (0..image.height) |y| {
//         for (0..image.width) |x| {
//             const i = (y * image.width + x) * 4;
//             var r: isize = 0;
//             var g: isize = 0;
//             var b: isize = 0;

//             for (0..3) |fy| {
//                 if ((fy == 0 and y == 0) or (fy == 2 and y + 1 == image.height)) {
//                     continue;
//                 }

//                 for (0..3) |fx| {
//                     if ((fx == 0 and x == 0) or (fx == 2 and x + 1 == image.width)) {
//                         continue;
//                     }

//                     const fi = fy * 3 + fx;
//                     const f = filter[fi];
//                     const j = ((y + fy - 1) * image.width + (x + fx - 1)) * 4;
//                     r += @intCast(isize, original_data[j + 0]) * f;
//                     g += @intCast(isize, original_data[j + 1]) * f;
//                     b += @intCast(isize, original_data[j + 2]) * f;
//                 }
//             }

//             r = @max(0, @min(r, 255));
//             g = @max(0, @min(g, 255));
//             b = @max(0, @min(b, 255));
//             processed_data[i + 0] = @intCast(u8, (@intCast(usize, r) * level + @intCast(usize, original_data[i + 0]) * (10 - level)) / 10);
//             processed_data[i + 1] = @intCast(u8, (@intCast(usize, g) * level + @intCast(usize, original_data[i + 1]) * (10 - level)) / 10);
//             processed_data[i + 2] = @intCast(u8, (@intCast(usize, b) * level + @intCast(usize, original_data[i + 2]) * (10 - level)) / 10);
//         }
//     }
// }

// test "Enhance image" {
//     var data = [_]u8{ 1, 2, 3, 255, 4, 5, 6, 255 };
//     var image = try Image.fromSlice(2, 1, &data);
//     defer image.deinit();

//     var agcwd = Agcwd.init(.{});

//     // 最初は常に状態の更新が必要
//     try expect(agcwd.isStateObsolete(image));
//     agcwd.updateState(image, null);

//     // すでに更新済み
//     try expect(!agcwd.isStateObsolete(image));

//     // 画像を処理
//     agcwd.enhanceImage(&image);
// }
