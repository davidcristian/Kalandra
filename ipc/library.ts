/** Why a Library session did not start: the name is not a valid file name, or main opened no file. */
export type LibrarySessionFailure = "invalid-name" | "failed";

/** The `session` action of `CLIENT->MAIN::write-data`: a start with the file name and CSV header, or a stop. */
export type LibrarySessionWrite =
  | { action: "session"; start: true; name: string; header: string }
  | { action: "session"; start: false };

/** main's reply to a Library session start, sent after it opened the session file or failed to. */
export interface IpcLibrarySession {
  name: "MAIN->CLIENT::library-session";
  payload: {
    sessionName: string;
    result: "started" | LibrarySessionFailure;
  };
}
