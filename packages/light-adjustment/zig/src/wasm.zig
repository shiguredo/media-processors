const std = @import("std");
const allocator = std.heap.wasm_allocator;

const light_adjustment = @import("./main.zig");
const Image = light_adjustment.Image;
const Agcwd = light_adjustment.Agcwd;

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

export fn imageNew(pixels: u32) ?*anyopaque {
    const image = allocator.create(Image) catch return null;
    errdefer allocator.destroy(image);

    const data = allocator.alloc(u8, pixels) catch return null;
    errdefer allocator.free(data);

    image.data = data;
    image.allocator = allocator;

    return image;
}

export fn imageFree(image_ptr: *anyopaque) void {
    const image = wasmPtrCast(*const Image, image_ptr);
    image.deinit();
    allocator.destroy(image);
}

export fn imageGetDataOffset(image_ptr: *anyopaque) *u8 {
    const image = wasmPtrCast(*const Image, image_ptr);
    return @ptrCast(*u8, image.data.ptr);
}

export fn agcwdNew() ?*anyopaque {
    const agcwd = allocator.create(Agcwd) catch return null;
    errdefer allocator.destroy(agcwd);

    agcwd.* = Agcwd.init(.{});
    return agcwd;
}

export fn agcwdFree(agcwd_ptr: *anyopaque) void {
    const agcwd = wasmPtrCast(*const Agcwd, agcwd_ptr);
    allocator.destroy(agcwd);
}

export fn agcwdSetAlpha(agcwd_ptr: *anyopaque, alpha: f32) void {
    const agcwd = wasmPtrCast(*Agcwd, agcwd_ptr);
    agcwd.options.alpha = alpha;
}

export fn agcwdSetFusion(agcwd_ptr: *anyopaque, fusion: f32) void {
    const agcwd = wasmPtrCast(*Agcwd, agcwd_ptr);
    agcwd.options.fusion = fusion;
}

export fn agcwdSetMinIntensity(agcwd_ptr: *anyopaque, min: u8) void {
    const agcwd = wasmPtrCast(*Agcwd, agcwd_ptr);
    agcwd.options.min_intensity = min;
}

export fn agcwdSetMaxIntensity(agcwd_ptr: *anyopaque, max: u8) void {
    const agcwd = wasmPtrCast(*Agcwd, agcwd_ptr);
    agcwd.options.max_intensity = max;
}

export fn agcwdSetMaskRatioThreshold(agcwd_ptr: *anyopaque, threshold: f32) void {
    const agcwd = wasmPtrCast(*Agcwd, agcwd_ptr);
    agcwd.options.mask_ratio_threshold = threshold;
}

export fn agcwdSetEntropyThreshold(agcwd_ptr: *anyopaque, threshold: f32) void {
    const agcwd = wasmPtrCast(*Agcwd, agcwd_ptr);
    agcwd.options.entropy_threshold = threshold;
}

export fn agcwdIsStateObsolete(agcwd_ptr: *anyopaque, image_ptr: *anyopaque) bool {
    const agcwd = wasmPtrCast(*const Agcwd, agcwd_ptr);
    const image = wasmPtrCast(*const Image, image_ptr);
    return agcwd.isStateObsolete(image.*);
}

export fn agcwdUpdateState(agcwd_ptr: *anyopaque, image_ptr: *anyopaque, mask_ptr: *anyopaque) void {
    const agcwd = wasmPtrCast(*Agcwd, agcwd_ptr);
    const image = wasmPtrCast(*const Image, image_ptr);
    const mask = wasmPtrCast(*const Image, mask_ptr);
    agcwd.updateState(image.*, mask.*);
}

export fn agcwdEnhanceImage(agcwd_ptr: *anyopaque, image_ptr: *anyopaque) void {
    const agcwd = wasmPtrCast(*const Agcwd, agcwd_ptr);
    const image = wasmPtrCast(*Image, image_ptr);
    agcwd.enhanceImage(image);
}

fn wasmPtrCast(comptime t: type, ptr: *anyopaque) t {
    return @ptrCast(t, @alignCast(@typeInfo(t).Pointer.alignment, ptr));
}
