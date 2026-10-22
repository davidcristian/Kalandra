import fs from "fs/promises";
import type { ImageData } from "./utils";
import type {
  LoaderFile,
  Mat,
  OpenCv,
  TessApi,
  TessModule,
} from "./wasm-types";

let tessModule: TessModule;
export let tessApi: TessApi;
export let cv: OpenCv;

const langMap = new Map([
  ["en", "eng"],
  ["ru", "rus"],
]);

export async function init(binDir: string) {
  if (process.platform !== "win32") {
    // so far only tested on Windows with BGRA images
    throw new Error("Unsupported platform");
  }

  const tessFile: LoaderFile<() => Promise<TessModule>> = await import(
    "file://" + binDir + "/tesseract-core-simd.js"
  );
  tessModule = await tessFile.default();
  tessApi = new tessModule.TessBaseAPI();

  const cvFile: LoaderFile<PromiseLike<OpenCv>> = await import(
    "file://" + binDir + "/opencv.js"
  );
  cv = await cvFile.default;
}

export async function changeLanguage(lang: string, binDir: string) {
  if (!langMap.has(lang)) {
    throw new Error("Unsupported language");
  }
  lang = langMap.get(lang)!;
  const langData = await fs.readFile(binDir + `/${lang}.traineddata`);
  tessModule.FS.writeFile(`${lang}.traineddata`, langData);
  if (tessApi.Init(null, lang, tessModule.OEM_DEFAULT)) {
    throw new Error("Could not initialize tesseract.");
  }
  tessModule.FS.unlink(`${lang}.traineddata`);
}

export function ocrSetImage(
  data: Uint8Array,
  width: number,
  height: number,
  bpp: number,
) {
  const imgPtr = tessModule._malloc(data.byteLength);
  tessModule.HEAPU8.set(data, imgPtr);
  if (bpp === 0) {
    tessApi.SetImage(imgPtr, width, height, 0, Math.ceil(width / 8));
  } else {
    tessApi.SetImage(imgPtr, width, height, bpp, width * bpp);
  }
  tessModule._free(imgPtr);
}

export function cvMatFromImage(img: ImageData): Mat {
  const mat = new cv.Mat(img.height, img.width, cv.CV_8UC4);
  mat.data.set(img.data);
  return mat;
}
