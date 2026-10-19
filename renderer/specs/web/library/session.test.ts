import { describe, expect, it } from "vitest";
import type { IpcEvent, IpcEventPayload } from "@ipc/types";
import { createLibrarySession } from "@/web/library/session";

type Reply = IpcEventPayload<"MAIN->CLIENT::library-session">;

/** Stands in for the connection to main: keeps what the page sends and delivers main's replies. */
class FakeHost {
  readonly sent: IpcEvent[] = [];
  private readonly bus = new EventTarget();

  sendEvent(event: IpcEvent) {
    this.sent.push(event);
  }

  onEvent<Name extends IpcEvent["name"]>(
    name: Name,
    cb: (payload: IpcEventPayload<Name>) => void,
  ): AbortController {
    const controller = new AbortController();
    this.bus.addEventListener(
      name,
      (e) => {
        cb((e as CustomEvent<IpcEventPayload<Name>>).detail);
      },
      { signal: controller.signal },
    );
    return controller;
  }

  reply(payload: Reply) {
    this.bus.dispatchEvent(
      new CustomEvent("MAIN->CLIENT::library-session", { detail: payload }),
    );
  }
}

function startedSession(name = "rolls") {
  const host = new FakeHost();
  const session = createLibrarySession(host);
  session.start(name, "a header");
  return { host, session };
}

describe("a Library session", () => {
  it("asks main to open the session file and waits for its reply", () => {
    const { host, session } = startedSession();

    expect(host.sent).toEqual([
      {
        name: "CLIENT->MAIN::write-data",
        payload: {
          action: "session",
          start: true,
          name: "rolls",
          header: "a header",
        },
      },
    ]);
    expect(session.state.value).toBe("starting");
  });

  it("becomes active when main opened the file", () => {
    const { host, session } = startedSession();
    host.reply({ sessionName: "rolls", result: "started" });

    expect(session.state.value).toBe("active");
    expect(session.failure.value).toBeNull();
  });

  it.each(["invalid-name", "failed"] as const)(
    "stays inactive and keeps the reason when main replies %s",
    (result) => {
      const { host, session } = startedSession();
      host.reply({ sessionName: "rolls", result });

      expect(session.state.value).toBe("idle");
      expect(session.failure.value).toBe(result);
    },
  );

  it("clears the last failure when it starts again", () => {
    const { host, session } = startedSession();
    host.reply({ sessionName: "rolls", result: "failed" });
    session.start("rolls", "a header");

    expect(session.failure.value).toBeNull();
    expect(session.state.value).toBe("starting");
  });

  it("ignores a reply for another session name", () => {
    const { host, session } = startedSession();
    host.reply({ sessionName: "older", result: "started" });

    expect(session.state.value).toBe("starting");
  });

  it("starts no second session while one is starting", () => {
    const { host, session } = startedSession();
    session.start("other", "a header");

    expect(host.sent).toHaveLength(1);
  });

  it("ignores a reply that comes after a stop", () => {
    const { host, session } = startedSession();
    session.stop();
    host.reply({ sessionName: "rolls", result: "started" });

    expect(session.state.value).toBe("idle");
    expect(host.sent.at(-1)).toEqual({
      name: "CLIENT->MAIN::write-data",
      payload: { action: "session", start: false },
    });
  });

  it("stops listening for replies after dispose", () => {
    const { host, session } = startedSession();
    session.dispose();
    host.reply({ sessionName: "rolls", result: "started" });

    expect(session.state.value).toBe("starting");
  });
});
