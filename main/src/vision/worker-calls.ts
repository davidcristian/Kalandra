import type { Logger } from "../RemoteLogger";

/** The events of a worker thread that end every call to it. */
export interface WorkerExitEvents {
  on: {
    (event: "error", listener: (error: Error) => void): unknown;
    (event: "exit", listener: (exitCode: number) => void): unknown;
  };
}

export class OcrWorkerStoppedError extends Error {
  name = "OcrWorkerStoppedError";
}

/** Rejects the calls still waiting for a reply, and every later call, once the OCR worker fails or exits. */
export class WorkerCalls {
  private readonly pending = new Set<(error: Error) => void>();
  private stopped?: OcrWorkerStoppedError;

  constructor(
    worker: WorkerExitEvents,
    private logger: Logger,
  ) {
    worker.on("error", (error) => {
      this.stop(`failed: ${error.message}`);
    });
    worker.on("exit", (exitCode) => {
      this.stop(`exited with code ${exitCode}`);
    });
  }

  async run<T>(call: () => Promise<T>): Promise<T> {
    if (this.stopped) throw this.stopped;
    return await new Promise<T>((resolve, reject) => {
      this.pending.add(reject);
      call()
        .then(resolve, reject)
        .finally(() => this.pending.delete(reject));
    });
  }

  private stop(reason: string) {
    if (this.stopped) return;
    this.stopped = new OcrWorkerStoppedError(`The OCR worker ${reason}`);
    this.logger.write(`error [OCR] Worker ${reason}`);
    for (const reject of this.pending) reject(this.stopped);
    this.pending.clear();
  }
}
