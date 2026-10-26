// The folder of the tray and window icons, which build/script.mjs defines in every bundle and the specs stub
declare namespace NodeJS {
  interface ProcessEnv {
    readonly STATIC: string;
  }
}
