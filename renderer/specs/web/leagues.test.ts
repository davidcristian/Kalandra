import { beforeEach, describe, expect, it, vi } from "vitest";
import { setupTests } from "@specs/vitest.setup";
import { AppConfig } from "@/web/Config";
import type * as Leagues from "@/web/background/Leagues";
import type { IpcEvent } from "@ipc/types";
import { HeldRequests, settle } from "./held-requests";

const LEAGUES = ["Standard", "Hardcore", "Rise of the Abyssal", "HC Abyssal"];

/**
 * Answers the league list request with the leagues in `ids`, as the trade site sends them, or with a web page while
 * `down` is set. While `held` is set, the leagues arrive only on its release().
 */
class FakeTradeSite {
  ids: string[] = LEAGUES;
  requests: string[] = [];
  down = false;
  held: HeldRequests | undefined;

  proxy = async (hostAndPath: string) => {
    this.requests.push(hostAndPath);
    if (this.down) return new Response("<html></html>", { status: 503 });
    const result = this.ids.map((id) => ({ id, realm: "poe2", text: id }));
    if (this.held) return await this.held.answer(JSON.stringify({ result }));
    return new Response(JSON.stringify({ result }));
  };
}

describe("useLeagues", () => {
  let site: FakeTradeSite;
  let leagues: ReturnType<typeof Leagues.useLeagues>;
  let sentToMain: IpcEvent[];

  async function loadWithSaved(leagueId: string | undefined) {
    setupTests({ leagueId });
    await leagues.load();
  }

  beforeEach(async () => {
    // useLeagues is one shared state per module, so each test imports a new one
    vi.resetModules();
    site = new FakeTradeSite();
    const { Host } = await import("@/web/background/IPC");
    vi.mocked(Host.proxy).mockImplementation(site.proxy);
    sentToMain = [];
    vi.mocked(Host.sendEvent).mockImplementation((event) => {
      sentToMain.push(event);
    });
    const { useLeagues } = await import("@/web/background/Leagues");
    leagues = useLeagues();
  });

  it("lists the leagues of the trade site and keeps a saved league it lists", async () => {
    await loadWithSaved("Hardcore");

    expect(site.requests).toEqual([
      "www.pathofexile.com/api/trade2/data/leagues",
    ]);
    expect(leagues.list.value).toEqual(LEAGUES.map((id) => ({ id, text: id })));
    expect(leagues.selectedId.value).toBe("Hardcore");
    expect(leagues.selected.value).toEqual({
      id: "Hardcore",
      realm: "pc-ggg",
      isPopular: true,
    });
    expect(leagues.error.value).toBeNull();
  });

  it("sends one request for calls during a running load, and another for a call after it", async () => {
    setupTests({ leagueId: "Hardcore" });
    site.held = new HeldRequests();
    const running = leagues.load();
    const repeated = leagues.load();
    await settle();

    expect(site.requests).toHaveLength(1);
    expect(leagues.isLoading.value).toBe(true);

    site.held.release();
    await Promise.all([running, repeated]);
    expect(leagues.isLoading.value).toBe(false);
    expect(leagues.list.value).toHaveLength(LEAGUES.length);

    site.held = undefined;
    await leagues.load();
    expect(site.requests).toHaveLength(2);
  });

  it("selects the third league in place of a saved league the site no longer lists", async () => {
    await loadWithSaved("Dawn of the Hunt");

    expect(AppConfig().leagueId).toBe("Rise of the Abyssal");
  });

  it("selects the first league when the site lists two or fewer", async () => {
    site.ids = ["Standard", "Hardcore"];
    await loadWithSaved(undefined);

    expect(AppConfig().leagueId).toBe("Standard");
  });

  it("keeps a saved private league that the site does not list, and reads no prices for it", async () => {
    await loadWithSaved("My League (PL12345)");

    expect(AppConfig().leagueId).toBe("My League (PL12345)");
    expect(leagues.selected.value?.isPopular).toBe(false);
  });

  it("reads no prices for a private league the site lists", async () => {
    site.ids = [...LEAGUES, "My League (PL12345)"];
    await loadWithSaved("My League (PL12345)");

    expect(leagues.selected.value?.isPopular).toBe(false);
  });

  it("reads no prices for a saved league the site does not list", () => {
    setupTests({ leagueId: "Dawn of the Hunt" });

    expect(leagues.selected.value?.isPopular).toBe(false);
  });

  it("keeps the saved league and sends the error to main's log when the site is down", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    site.down = true;
    await loadWithSaved("Hardcore");

    expect(AppConfig().leagueId).toBe("Hardcore");
    expect(sentToMain).toEqual([
      {
        name: "CLIENT->MAIN::log-entry",
        payload: {
          level: "warn",
          message:
            "Cannot load the trade leagues: The trade site sent a web page instead of data (status 503). It can be down, under maintenance or showing a bot check.",
        },
      },
    ]);
  });

  it("replaces a saved Path of Exile 1 Ruthless league, which the site does not list", async () => {
    await loadWithSaved("Ruthless Settlers");

    expect(AppConfig().leagueId).toBe("Rise of the Abyssal");
  });
});
