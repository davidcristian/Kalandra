import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createSSRApp } from "vue";
import { renderToString } from "vue/server-renderer";
import { setupTests } from "@specs/vitest.setup";
import { init } from "@/web/i18n";
import About from "@/web/settings/about.vue";

let plugin: Awaited<ReturnType<typeof init>>;

beforeAll(async () => {
  setupTests();
  vi.stubGlobal("document", { documentElement: { lang: "" } });
  plugin = await init("en");
});

afterAll(() => {
  vi.unstubAllGlobals();
});

describe("the About page", () => {
  it("names each subreddit by the path of the link that opens it", async () => {
    const html = await renderToString(createSSRApp(About).use(plugin));
    const links = [
      ...html.matchAll(
        /href="https:\/\/old\.reddit\.com\/(r\/[^"]+)"[^>]*>([^<]*)<\/a>/g,
      ),
    ].map((match) => [match[1], match[2].trim()]);

    expect(links).toEqual([["r/pathofexile2", "r/pathofexile2"]]);
  });
});
