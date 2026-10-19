/** Why a Library session did not start: the name is not a valid file name, or main opened no file. */
export type LibrarySessionFailure = "invalid-name" | "failed";

/** main's reply to a Library session start, sent after it opened the session file or failed to. */
export interface IpcLibrarySession {
  name: "MAIN->CLIENT::library-session";
  payload: {
    sessionName: string;
    result: "started" | LibrarySessionFailure;
  };
}
