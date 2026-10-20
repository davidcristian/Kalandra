import * as crypto from "crypto";
import { EventEmitter } from "events";
import * as fs from "fs";
import { createServer, type IncomingMessage, type ServerResponse } from "http";
import type { AddressInfo } from "net";
import * as path from "path";
import { app } from "electron";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { addFileUploadRoutes } from "../src/host-files/file-uploads";
import { Logger } from "../src/RemoteLogger";
import type { HttpRoutes } from "../src/server";
import { FakeServer } from "./fake-server";
import { get, post } from "./request";

vi.mock("electron", async () => {
  const fs = await import("node:fs");
  const os = await import("node:os");
  const path = await import("node:path");
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), "kalandra-uploads-"));
  return { app: { getPath: () => userData } };
});

const uploads = path.join(app.getPath("userData"), "apt-data", "files");
const routes: HttpRoutes = new EventEmitter<{
  request: [IncomingMessage, ServerResponse];
}>();
const server = createServer((req, res) => routes.emit("request", req, res));
const events = new FakeServer();
const logger = new Logger(events);
let port = 0;

const md5 = (text: string) =>
  crypto.createHash("md5").update(text).digest("hex");

beforeAll(async () => {
  addFileUploadRoutes(routes, logger);
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });
  port = (server.address() as AddressInfo).port;
});

beforeEach(() => {
  fs.rmSync(uploads, { recursive: true, force: true });
  events.sent.length = 0;
});

afterAll(() => {
  server.close();
  fs.rmSync(app.getPath("userData"), { recursive: true, force: true });
});

describe("POST /uploads/<name>", () => {
  it("stores an image under its MD5 hash and returns the stored name", async () => {
    const reply = await post(port, "/uploads/cheat-sheet.png", "image");

    const name = `${md5("image")}.png`;
    expect(reply).toEqual({ status: 200, body: JSON.stringify({ name }) });
    expect(await get(port, `/uploads/${name}`)).toEqual({
      status: 200,
      body: "image",
    });
  });

  it("stores the extension in lower case and leaves out a query string", async () => {
    const upper = await post(port, "/uploads/Photo.JPG", "photo");
    expect(JSON.parse(upper.body)).toEqual({ name: `${md5("photo")}.jpg` });

    const query = await post(port, "/uploads/map.webp?size=2", "map");
    expect(JSON.parse(query.body)).toEqual({ name: `${md5("map")}.webp` });
  });

  it.each(["notes.html", "tool.exe", "no-extension", "image.png%3Fx"])(
    "returns 415 for %s and stores nothing",
    async (name) => {
      const reply = await post(port, `/uploads/${name}`, "data");

      expect(reply.status).toBe(415);
      expect(fs.existsSync(uploads)).toBe(false);
      expect(events.logEntries().join("")).toContain(
        "warn [uploads] Not an image file",
      );
    },
  );

  it("returns 500 and logs the error when the file cannot be written", async () => {
    fs.mkdirSync(path.dirname(uploads), { recursive: true });
    fs.writeFileSync(uploads, "a file where the uploads folder should be");

    const reply = await post(port, "/uploads/cheat-sheet.png", "image");

    expect(reply.status).toBe(500);
    expect(events.logEntries().join("")).toContain("error [uploads]");
  });
});
