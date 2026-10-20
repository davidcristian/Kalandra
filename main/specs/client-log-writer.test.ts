import { describe, expect, it } from "vitest";
import { clientLogWriter } from "../src/client-log-writer";

function isOverlay(client: string): boolean {
  return client.startsWith("overlay");
}

describe("clientLogWriter", () => {
  it("returns the overlay window while a browser tab is the last active client", () => {
    expect(clientLogWriter(["overlay", "tab"], isOverlay, "tab")).toBe(
      "overlay",
    );
  });

  it("returns the newest overlay window while an older one is still connected", () => {
    const clients = ["overlay old", "tab", "overlay new"];
    expect(clientLogWriter(clients, isOverlay, "tab")).toBe("overlay new");
  });

  it("returns the last active client when no overlay window is connected", () => {
    const clients = ["tab 1", "tab 2", "tab 3"];
    expect(clientLogWriter(clients, isOverlay, "tab 2")).toBe("tab 2");
  });
});
