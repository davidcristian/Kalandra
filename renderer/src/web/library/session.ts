import { shallowRef } from "vue";
import type { LibrarySessionFailure } from "@ipc/library";
import { Host } from "@/web/background/IPC";

type HostEvents = Pick<typeof Host, "sendEvent" | "onEvent">;

/** A Library session, active only after main replies that it opened the session file. */
export function createLibrarySession(host: HostEvents = Host) {
  const state = shallowRef<"idle" | "starting" | "active">("idle");
  const failure = shallowRef<LibrarySessionFailure | null>(null);
  let startingName: string | null = null;

  const listener = host.onEvent("MAIN->CLIENT::library-session", (e) => {
    if (state.value !== "starting" || e.sessionName !== startingName) return;
    startingName = null;
    if (e.result === "started") {
      state.value = "active";
    } else {
      state.value = "idle";
      failure.value = e.result;
    }
  });

  function start(name: string, header: string) {
    if (state.value !== "idle") return;
    failure.value = null;
    startingName = name;
    state.value = "starting";
    host.sendEvent({
      name: "CLIENT->MAIN::write-data",
      payload: { action: "session", start: true, name, header },
    });
  }

  function stop() {
    startingName = null;
    state.value = "idle";
    host.sendEvent({
      name: "CLIENT->MAIN::write-data",
      payload: { action: "session", start: false },
    });
  }

  return { state, failure, start, stop, dispose: () => listener.abort() };
}
