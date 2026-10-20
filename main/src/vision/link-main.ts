import { Worker } from "worker_threads";
import * as Comlink from "comlink";
import nodeEndpoint, { type NodeEndpoint } from "comlink/dist/umd/node-adapter";
import type { WorkerAPI } from "./link-worker";
import type { ImageData } from "./utils";
import { WorkerCalls, type WorkerExitEvents } from "./worker-calls";
import type { Logger } from "../RemoteLogger";
import { app } from "electron";
import path from "path";

export type OcrThread = NodeEndpoint & WorkerExitEvents;

export class OcrWorker {
  private binDir = path.join(app.getPath("userData"), "apt-data/cv-ocr");
  private api: Comlink.Remote<WorkerAPI>;
  private calls: WorkerCalls;
  private lang = "";

  private constructor(thread: OcrThread, logger: Logger) {
    this.api = Comlink.wrap<WorkerAPI>(nodeEndpoint(thread));
    this.calls = new WorkerCalls(thread, logger);
  }

  static async create(
    logger: Logger,
    thread: OcrThread = new Worker(path.join(__dirname, "vision.js")),
  ) {
    const worker = new OcrWorker(thread, logger);
    try {
      await worker.calls.run(async () => {
        await worker.api.init(worker.binDir);
      });
    } catch {}
    return worker;
  }

  async updateOptions(lang: string) {
    try {
      if (lang !== this.lang) {
        await this.calls.run(async () => {
          await this.api.changeLanguage(lang, this.binDir);
        });
      }
    } catch {
    } finally {
      this.lang = lang;
    }
  }

  async findHeistGems(image: ImageData) {
    const result = await this.calls.run(
      async () =>
        await this.api.findHeistGems(
          Comlink.transfer(image, [image.data.buffer]),
        ),
    );
    return result;
  }
}
