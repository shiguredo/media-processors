const std = @import("std");
const allocator = std.heap.wasm_allocator;

const light_adjustment = @import("./main.zig");
const LightAdjustment = light_adjustment.LightAdjustment;

pub const std_options = struct {
    pub const logFn = log;
};

pub fn log(
    comptime level: std.log.Level,
    comptime scope: @TypeOf(.EnumLiteral),
    comptime format: []const u8,
    args: anytype,
) void {
    _ = level;
    _ = scope;
    _ = format;
    _ = args;
}

export fn new(width: u32, height: u32) ?*anyopaque {
    const la = allocator.create(LightAdjustment) catch return null;
    errdefer allocator.destroy(la);

    la.* = LightAdjustment.init(allocator, width, height) catch return null;
    return la;
}

export fn free(ptr: *anyopaque) void {
    const la = wasmPtrCast(*const LightAdjustment, ptr);
    la.deinit();
    allocator.destroy(la);
}

export fn isStateObsolete(ptr: *anyopaque) bool {
    const la = wasmPtrCast(*const LightAdjustment, ptr);
    return la.isStateObsolete();
}

export fn updateState(ptr: *anyopaque) void {
    const la = wasmPtrCast(*LightAdjustment, ptr);
    la.updateState();
}

export fn processImage(ptr: *anyopaque) void {
    const la = wasmPtrCast(*LightAdjustment, ptr);
    la.processImage();
}

export fn resize(ptr: *anyopaque, width: u32, height: u32) bool {
    const la = wasmPtrCast(*LightAdjustment, ptr);
    la.resize(width, height) catch return false;
    return true;
}

export fn getImageData(ptr: *anyopaque) *u8 {
    const la = wasmPtrCast(*const LightAdjustment, ptr);
    return @ptrCast(*u8, la.image.data.ptr);
}

export fn getFocusMaskData(ptr: *anyopaque) *u8 {
    const la = wasmPtrCast(*const LightAdjustment, ptr);
    return @ptrCast(*u8, la.mask.data.ptr);
}

// オプション設定系（バリデーションは TypeScript 側で行なっている前提）
export fn setAlpha(ptr: *anyopaque, alpha: f32) void {
    const la = wasmPtrCast(*LightAdjustment, ptr);
    la.options.alpha = alpha;
}

export fn setAdjustmentLevel(ptr: *anyopaque, level: u8) void {
    const la = wasmPtrCast(*LightAdjustment, ptr);
    la.options.adjustment_level = level;
}

export fn setSharpnessLevel(ptr: *anyopaque, level: u8) void {
    const la = wasmPtrCast(*LightAdjustment, ptr);
    la.options.sharpness_level = level;
}

export fn setMinIntensity(ptr: *anyopaque, min: u8) void {
    const la = wasmPtrCast(*LightAdjustment, ptr);
    la.options.min_intensity = min;
}

export fn setMaxIntensity(ptr: *anyopaque, max: u8) void {
    const la = wasmPtrCast(*LightAdjustment, ptr);
    la.options.max_intensity = max;
}

export fn setEntropyThreshold(ptr: *anyopaque, threshold: f32) void {
    const la = wasmPtrCast(*LightAdjustment, ptr);
    la.options.entropy_threshold = threshold;
}

fn wasmPtrCast(comptime t: type, ptr: *anyopaque) t {
    return @ptrCast(t, @alignCast(@typeInfo(t).Pointer.alignment, ptr));
}
