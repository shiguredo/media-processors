light-adjustment-zig
====================

Zig によるライト調整機能の実装。
WebAssembly にビルドされて TypeScript から利用される。

ビルド方法
----------

```console
$ zig build -Dtarget=wasm32-freestanding
$ ls zig-out/lib/light_adjustment.wasm
zig-out/lib/light_adjustment.wasm*
```

ユニットテスト
-------------

```console
$ zig build test
```
