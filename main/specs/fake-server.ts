import type { IpcEvent, IpcEventPayload } from "../../ipc/types";
import type { ServerEvents } from "../src/server";

type Handler = (payload: never) => unknown;

/** Stands in for the event server: keeps what main sends and lets a test send client events. */
export class FakeServer implements ServerEvents {
  readonly sent: IpcEvent[] = [];
  private readonly handlers = new Map<string, Handler[]>();

  onEventAnyClient: ServerEvents["onEventAnyClient"] = (name, cb) => {
    this.handlers.set(name, [...(this.handlers.get(name) ?? []), cb]);
  };

  sendEventTo: ServerEvents["sendEventTo"] = (_target, event) => {
    this.sent.push(event);
  };

  /** Calls the handlers at once, and settles when the promises they return settle. */
  async emit<Name extends IpcEvent["name"]>(
    name: Name,
    payload: IpcEventPayload<Name>,
  ): Promise<void> {
    const handlers = (this.handlers.get(name) ?? []) as Array<
      (payload: IpcEventPayload<Name>) => unknown
    >;
    await Promise.all(handlers.map((cb) => cb(payload)));
  }

  gameLogLines(): string[] {
    return this.sent.flatMap((event) =>
      event.name === "MAIN->CLIENT::game-log" ? event.payload.lines : [],
    );
  }
}
