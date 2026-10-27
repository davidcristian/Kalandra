/** The levels of a line the renderer sends to main's log, the words that start main's own lines. */
export type RendererLogLevel = "error" | "warn" | "info";

/** A line that the renderer sends to main's log, which Settings, Debug shows. */
export interface IpcRendererLogEntry {
  name: "CLIENT->MAIN::log-entry";
  payload: { level: RendererLogLevel; message: string };
}
