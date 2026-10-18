import * as fs from "fs";
import * as path from "path";
import type { AddressInfo } from "net";
import { app } from "electron";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { server } from "../src/server";
import { get } from "./request";

vi.mock("electron", async () => {
  const fs = await import("node:fs");
  const os = await import("node:os");
  const path = await import("node:path");
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), "kalandra-main-"));
  return { app: { getPath: () => userData, getVersion: () => "0.0.0" } };
});

const userData = app.getPath("userData");
let port = 0;

beforeAll(async () => {
  const uploads = path.join(userData, "apt-data", "files");
  fs.mkdirSync(uploads, { recursive: true });
  fs.writeFileSync(path.join(uploads, "image.png"), "image");
  fs.writeFileSync(path.join(userData, "secret.txt"), "secret");
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });
  port = (server.address() as AddressInfo).port;
});

afterAll(() => {
  server.close();
  fs.rmSync(userData, { recursive: true, force: true });
});

describe("the uploads route", () => {
  it("serves a file in the uploads folder", async () => {
    expect(await get(port, "/uploads/image.png")).toEqual({
      status: 200,
      body: "image",
    });
  });

  it("answers 404 for a path outside the uploads folder", async () => {
    expect(await get(port, "/uploads/../../secret.txt")).toEqual({
      status: 404,
      body: "",
    });
  });

  it("answers 404 for a missing file", async () => {
    expect((await get(port, "/uploads/missing.png")).status).toBe(404);
  });
});

describe("the static file route", () => {
  it("serves a file from the folder of the server bundle", async () => {
    expect((await get(port, "/listen-option.ts")).status).toBe(200);
  });

  it("answers 404 for a path outside that folder", async () => {
    const reply = await get(port, "/../package.json");
    expect(reply.status).toBe(404);
    expect(reply.body).not.toContain("kalandra");
  });
});
