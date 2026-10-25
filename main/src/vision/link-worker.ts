import { parentPort } from "worker_threads";
import * as Comlink from "comlink";
import nodeEndpoint from "comlink/dist/umd/node-adapter";
import * as Bindings from "./wasm-bindings";
import { HeistGemFinder } from "./HeistGemFinder";
import { ImageData } from "./utils";

let _heistGems: HeistGemFinder;
let _lastLangChange = Promise.resolve();

const WorkerBody = {
  async init(binDir: string) {
    await Bindings.init(binDir);
    _heistGems = await HeistGemFinder.create(binDir);
  },
  async changeLanguage(lang: string, binDir: string) {
    const previous = _lastLangChange;
    // The previous caller gets the error of a failed change, so the next change only waits for it to end
    _lastLangChange = Promise.allSettled([previous]).then(async () => {
      await Bindings.changeLanguage(lang, binDir);
    });
    await _lastLangChange;
  },
  async findHeistGems(screenshot: ImageData) {
    await _lastLangChange;
    return _heistGems.ocrScreenshot(screenshot);
  },
};
Comlink.expose(WorkerBody, nodeEndpoint(parentPort!));

export type WorkerAPI = Comlink.Remote<typeof WorkerBody>;
