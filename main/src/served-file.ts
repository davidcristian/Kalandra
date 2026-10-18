import * as fs from "fs";
import * as path from "path";
import type { ServerResponse } from "http";

// Node passes req.url on as sent, so "/uploads/../../x" reaches a route unchanged
export function resolveInside(
  folder: string,
  urlPath: string,
): string | undefined {
  if (urlPath.includes("\0")) return undefined;
  const root = path.resolve(folder);
  const target = path.join(root, urlPath);
  const relative = path.relative(root, target);
  if (
    !relative ||
    relative.split(path.sep)[0] === ".." ||
    path.isAbsolute(relative)
  ) {
    return undefined;
  }
  return target;
}

export function sendFile(
  res: ServerResponse,
  folder: string,
  urlPath: string,
): void {
  const filePath = resolveInside(folder, urlPath);
  if (!filePath) {
    notFound(res);
    return;
  }
  fs.createReadStream(filePath)
    .once("error", () => {
      notFound(res);
    })
    .pipe(res);
}

function notFound(res: ServerResponse) {
  if (!res.headersSent) res.statusCode = 404;
  res.end();
}
