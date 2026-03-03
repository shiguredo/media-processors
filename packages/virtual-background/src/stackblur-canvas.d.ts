// stackblur-canvas@3.0.0 の package.json "exports" に "types" エントリが含まれていないため、
// moduleResolution: "bundler" では同梱の index.d.ts が解決できない。
// ライブラリ側で修正されるまでの回避策として、型宣言をここで再定義する。
declare module "stackblur-canvas" {
  export class BlurStack {
    r: number;
    g: number;
    b: number;
    a: number;
    next: BlurStack;
  }

  export function image(
    img: HTMLImageElement | string,
    canvas: HTMLCanvasElement | string,
    radius: number,
    blurAlphaChannel?: boolean,
    useOffset?: boolean,
    skipStyles?: boolean,
  ): void;

  export function canvasRGBA(
    canvas: HTMLCanvasElement,
    topX: number,
    topY: number,
    width: number,
    height: number,
    radius: number,
  ): void;

  export function canvasRGB(
    canvas: HTMLCanvasElement,
    topX: number,
    topY: number,
    width: number,
    height: number,
    radius: number,
  ): void;

  export function imageDataRGBA(
    data: ImageData,
    topX: number,
    topY: number,
    width: number,
    height: number,
    radius: number,
  ): ImageData;

  export function imageDataRGB(
    data: ImageData,
    topX: number,
    topY: number,
    width: number,
    height: number,
    radius: number,
  ): ImageData;
}
