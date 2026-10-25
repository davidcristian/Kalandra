import { inspect } from "node:util";
import type { Logger } from "./RemoteLogger";

/** The part of `process` that emits the errors no code caught. */
export interface UncaughtErrorEvents {
  on: (
    event: "uncaughtException" | "unhandledRejection",
    listener: (reason: unknown) => void,
  ) => unknown;
}

/** Returns the stack of an Error, or the text of any other value code can throw or reject with. */
export function errorText(reason: unknown): string {
  if (reason instanceof Error) return reason.stack ?? String(reason);
  return inspect(reason);
}

/** Logs each error that no code caught and each rejection that no code handled. */
export function logUncaughtErrors(
  events: UncaughtErrorEvents,
  logger: Logger,
): void {
  events.on("uncaughtException", (error) => {
    logger.write(`error [uncaughtException] ${errorText(error)}`);
  });
  events.on("unhandledRejection", (reason) => {
    logger.write(`error [unhandledRejection] ${errorText(reason)}`);
  });
}
