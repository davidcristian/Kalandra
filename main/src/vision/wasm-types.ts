/** The members of the OpenCV.js and Tesseract WebAssembly modules that the vision code uses. */

export interface CvSize {
  width: number;
  height: number;
}

export interface CvPoint {
  x: number;
  y: number;
}

export interface CvRect extends CvPoint, CvSize {}

export interface Mat {
  rows: number;
  cols: number;
  data: Uint8Array;
  channels: () => number;
  intAt: (row: number, col: number) => number;
  floatAt: (row: number, col: number) => number;
  roi: (rect: CvRect) => Mat;
  delete: () => void;
}

interface MatConstructor {
  new (): Mat;
  new (rows: number, cols: number, type: number): Mat;
}

export interface OpenCv {
  Mat: MatConstructor;
  Size: new (width: number, height: number) => CvSize;
  Point: new (x: number, y: number) => CvPoint;
  Rect: new (point: CvPoint, size: CvSize) => CvRect;
  CV_8U: number;
  CV_8UC4: number;
  COLOR_RGBA2GRAY: number;
  COLOR_BGR2GRAY: number;
  COLOR_BGR2HSV_FULL: number;
  INTER_LINEAR: number;
  TM_CCOEFF_NORMED: number;
  THRESH_TOZERO: number;
  cvtColor: (src: Mat, dst: Mat, code: number) => void;
  resize: (
    src: Mat,
    dst: Mat,
    size: CvSize,
    fx: number,
    fy: number,
    interpolation: number,
  ) => void;
  matchTemplate: (image: Mat, templ: Mat, result: Mat, method: number) => void;
  threshold: (
    src: Mat,
    dst: Mat,
    thresh: number,
    maxValue: number,
    type: number,
  ) => number;
  inRange: (src: Mat, lower: Mat, upper: Mat, dst: Mat) => void;
  bitwise_not: (src: Mat, dst: Mat) => void;
  findNonZero: (src: Mat, locations: Mat) => void;
}

export interface TessApi {
  Init: (dataPath: null, language: string, engineMode: number) => number;
  SetImage: (
    pointer: number,
    width: number,
    height: number,
    bytesPerPixel: number,
    bytesPerLine: number,
  ) => void;
  SetVariable: (name: string, value: string) => boolean;
  Recognize: () => number;
  GetUTF8Text: () => string;
  MeanTextConf: () => number;
}

export interface TessModule {
  TessBaseAPI: new () => TessApi;
  FS: {
    writeFile: (path: string, data: Uint8Array) => void;
    unlink: (path: string) => void;
  };
  OEM_DEFAULT: number;
  HEAPU8: Uint8Array;
  _malloc: (size: number) => number;
  _free: (pointer: number) => void;
}

/** The namespace object that a dynamic import of one of the WebAssembly loaders returns. */
export interface LoaderFile<T> {
  default: T;
}
