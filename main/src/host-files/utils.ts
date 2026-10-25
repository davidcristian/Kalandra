import { access, constants } from "fs/promises";

/**
 * Returns the one readable path, `null` when more than one is readable, or `undefined` when none is.
 * Passes the message of each error other than a missing file to `onUnreadable`.
 */
export async function guessFileLocation(
  entries: Iterable<string>,
  onUnreadable: (message: string) => void,
): Promise<string | null | undefined> {
  let found: string | null | undefined;
  for (const path of entries) {
    try {
      await access(path, constants.R_OK);
    } catch (error) {
      // The game is installed in at most one of the default folders, so a missing file is expected
      const { code, message } = error as NodeJS.ErrnoException;
      if (code !== "ENOENT") onUnreadable(message);
      continue;
    }
    if (found != null) {
      // don't allow multiple matches (i.e. standalone + Steam)
      return null;
    }
    found = path;
  }
  return found;
}
