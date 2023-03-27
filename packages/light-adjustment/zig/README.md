light-adjustment-zig
====================

Zig によるライト調整機能の実装です。
WebAssembly にビルドされて TypeScript から利用されます。

ビルド方法
----------

```console
$ zig build -Dtarget=wasm32-freestanding
$ ls zig-out/lib/light_adjustment.wasm
zig-out/lib/light_adjustment.wasm*
```

ユニットテストの実行方法
------------------------

```console
$ zig build test
```
