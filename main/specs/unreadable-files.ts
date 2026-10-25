import type * as FsPromises from "fs/promises";

/** The paths that the access() of withUnreadableFiles() rejects, as Node.js does for a file without read permission. */
export const unreadableFiles = new Set<string>();

/** Returns fs/promises with an access() that rejects with EACCES for each path in unreadableFiles. */
export function withUnreadableFiles(
  actual: typeof FsPromises,
): typeof FsPromises {
  return {
    ...actual,
    access: async (file, mode) => {
      if (typeof file === "string" && unreadableFiles.has(file)) {
        throw Object.assign(
          new Error(`EACCES: permission denied, access '${file}'`),
          { code: "EACCES" },
        );
      }
      await actual.access(file, mode);
    },
  };
}
