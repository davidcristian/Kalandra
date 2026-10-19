import { EventEmitter } from "events";
import type { IpcEvent, IpcEventPayload } from "../../ipc/types";
import type { ServerEvents } from "../src/server";

/** Stands in for the event server: keeps what main sends and lets a test send client events. */
export class FakeServer implements ServerEvents {
  readonly sent: IpcEvent[] = [];
  private readonly bus = new EventEmitter();

  onEventAnyClient: ServerEvents["onEventAnyClient"] = (name, cb) => {
    this.bus.on(name, cb);
  };

  sendEventTo: ServerEvents["sendEventTo"] = (_target, event) => {
    this.sent.push(event);
  };

  emit<Name extends IpcEvent["name"]>(
    name: Name,
    payload: IpcEventPayload<Name>,
  ) {
    this.bus.emit(name, payload);
  }

  gameLogLines(): string[] {
    return this.sent.flatMap((event) =>
      event.name === "MAIN->CLIENT::game-log" ? event.payload.lines : [],
    );
  }
}
