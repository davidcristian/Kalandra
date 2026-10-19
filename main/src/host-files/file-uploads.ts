import path from "path";
import crypto from "crypto";
import { promises as fs } from "fs";
import { app } from "electron";
import type { HttpRoutes } from "../server";
import type { Logger } from "../RemoteLogger";
import { sendFile } from "../served-file";

// The image strip picks files with accept="image/*"; these are the image types Chromium shows in an <img>
const IMAGE_EXTENSIONS = new Set([
  ".apng",
  ".avif",
  ".bmp",
  ".gif",
  ".ico",
  ".jfif",
  ".jpeg",
  ".jpg",
  ".png",
  ".webp",
]);

export function addFileUploadRoutes(routes: HttpRoutes, logger: Logger) {
  const uploadsPath = path.join(app.getPath("userData"), "apt-data", "files");

  routes.addListener("request", (req, res) => {
    if (req.method !== "GET" || !req.url?.startsWith("/uploads/")) return;

    sendFile(res, uploadsPath, req.url.slice("/uploads/".length));
  });

  routes.addListener("request", (req, res) => {
    if (req.method !== "POST" || !req.url?.startsWith("/uploads/")) return;

    const extension = imageExtension(req.url);
    if (!extension) {
      logger.write(`warn [uploads] Not an image file: ${req.url}`);
      res.statusCode = 415;
      res.end();
      return;
    }

    let contents = Buffer.alloc(0);
    req.on("data", (chunk) => {
      if (contents.length > 16_000_000) {
        return req.destroy();
      }
      contents = Buffer.concat([contents, chunk]);
    });
    req.once("end", () => {
      const hash = crypto.createHash("md5").update(contents).digest("hex");
      const filename = `${hash}${extension}`;

      writeUpload(uploadsPath, filename, contents).then(
        () => {
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify({ name: filename }));
        },
        (error: Error) => {
          logger.write(`error [uploads] ${error.message}`);
          res.statusCode = 500;
          res.end();
        },
      );
    });
  });
}

function imageExtension(url: string): string | undefined {
  const { pathname } = new URL(url, "http://localhost");
  const extension = path.posix.extname(pathname).toLowerCase();
  return IMAGE_EXTENSIONS.has(extension) ? extension : undefined;
}

async function writeUpload(folder: string, filename: string, contents: Buffer) {
  await fs.mkdir(folder, { recursive: true });
  await fs.writeFile(path.join(folder, filename), contents);
}
