import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRenderer, nextTick } from "vue";
import type { IpcEvent, IpcEventPayload } from "@ipc/types";
import { present } from "@specs/present";
import { priceCheckWidgetMock, setupFetchMock } from "@specs/vitest.setup";
import type { Config } from "@/web/Config";
import type { Widget } from "@/web/overlay/widgets";
import {
  stashPricesDefault,
  type StashPricesWidget,
} from "@/web/stash-prices/widget";

// Each widget renders as an empty div, so a test sees which widgets the overlay draws
vi.mock("@/web/overlay/widget-registry", async () => {
  const { h } = await import("vue");
  const widget = { render: () => h("div") };
  return { registry: { widgets: [], getWidgetComponent: () => widget } };
});

// The leagues load from the trade site, which no test calls
vi.mock("@/web/background/Leagues", async () => {
  const { computed, shallowRef } = await import("vue");
  const selectedId = shallowRef("Standard");
  const selected = computed(() => ({
    id: selectedId.value,
    realm: "pc-ggg",
    isPopular: true,
  }));
  const load = async () => {};
  return { useLeagues: () => ({ selectedId, selected, load }) };
});

type ConfigModule = typeof import("@/web/Config");

/** An element, text or comment of the fake page, with the props and the display that Vue sets on it. */
interface FakeNode {
  tag: string;
  text: string;
  props: Record<string, unknown>;
  style: { display?: string };
  children: FakeNode[];
  parent: FakeNode | null;
}

function fakeNode(tag: string, text = ""): FakeNode {
  return { tag, text, props: {}, style: {}, children: [], parent: null };
}

function detach(node: FakeNode) {
  node.parent?.children.splice(node.parent.children.indexOf(node), 1);
  node.parent = null;
}

const { createApp } = createRenderer<FakeNode, FakeNode>({
  createElement: (tag) => fakeNode(tag),
  createText: (text) => fakeNode("#text", text),
  createComment: (text) => fakeNode("#comment", text),
  insert(node, parent, anchor) {
    detach(node);
    const at = anchor ? parent.children.indexOf(anchor) : -1;
    parent.children.splice(at === -1 ? parent.children.length : at, 0, node);
    node.parent = parent;
  },
  remove: detach,
  setText(node, text) {
    node.text = text;
  },
  setElementText(element, text) {
    element.children = [];
    if (text) {
      const node = fakeNode("#text", text);
      node.parent = element;
      element.children.push(node);
    }
  },
  parentNode: (node) => node.parent,
  nextSibling(node) {
    const siblings = node.parent?.children ?? [];
    return siblings[siblings.indexOf(node) + 1] ?? null;
  },
  patchProp(element, key, _prev, next) {
    element.props[key] = next;
  },
});

/** Returns the nodes under `root` in document order. */
function descendants(root: FakeNode): FakeNode[] {
  return root.children.flatMap((child) => [child, ...descendants(child)]);
}

const MENU = 1;
const PRICE_CHECK = 2;
const XP_TRACKER = 6;

/** The widgets of the test config with their flags in a new config, the `shown` ones with `wmWants` "show". */
function testWidgets(
  shown: number[],
  stashPrices: Partial<StashPricesWidget> = {},
): Widget[] {
  const widgets: Widget[] = [
    {
      wmId: MENU,
      wmType: "menu",
      wmTitle: "",
      wmWants: "hide",
      wmZorder: 1,
      wmFlags: ["invisible-on-blur", "menu::skip"],
    },
    priceCheckWidgetMock(),
    // pushHostConfig() reads the item check and library widgets, which every config has
    {
      wmId: 3,
      wmType: "item-check",
      wmTitle: "",
      wmWants: "hide",
      wmZorder: "exclusive",
      wmFlags: ["hide-on-blur", "menu::skip"],
    },
    {
      wmId: 4,
      wmType: "library",
      wmTitle: "",
      wmWants: "hide",
      wmZorder: null,
      wmFlags: ["invisible-on-blur", "menu::skip"],
    },
    { ...stashPricesDefault(), wmId: 5, ...stashPrices },
    {
      wmId: XP_TRACKER,
      wmType: "experience-tracker",
      wmTitle: "",
      wmWants: "hide",
      wmZorder: null,
      wmFlags: [],
    },
  ];
  return widgets.map((widget) =>
    shown.includes(widget.wmId) ? { ...widget, wmWants: "show" } : widget,
  );
}

/** The page's window, with the events and the size that the overlay reads. */
class FakeWindow extends EventTarget {
  innerWidth = 1920;
  innerHeight = 1080;
  devicePixelRatio = 1;
}

describe("OverlayWindow.vue", () => {
  let actual: ConfigModule;
  let mainEvents: EventTarget;
  let sent: IpcEvent[];
  let page: FakeWindow;
  let unmount: (() => void) | undefined;

  beforeEach(async () => {
    vi.useFakeTimers();
    // The config, the prices and the stash layer are shared state of their modules
    vi.resetModules();
    page = new FakeWindow();
    vi.stubGlobal("window", page);
    vi.stubGlobal(
      "document",
      Object.assign(new EventTarget(), {
        documentElement: { lang: "", style: {} },
      }),
    );
    vi.stubGlobal("navigator", { userAgent: "Windows NT 10.0 Electron" });
    setupFetchMock();
    const { Host } = await import("@/web/background/IPC");
    sent = [];
    mainEvents = new EventTarget();
    vi.mocked(Host.sendEvent).mockImplementation((event) => {
      sent.push(event);
    });
    vi.mocked(Host.onEvent).mockImplementation((name, cb) => {
      const controller = new AbortController();
      const listener = cb as (payload: unknown) => void;
      mainEvents.addEventListener(
        name,
        (e) => {
          listener((e as CustomEvent).detail);
        },
        { signal: controller.signal },
      );
      return controller;
    });
    // The page saves the config with the real module in place of the mock in vitest.setup.ts
    actual = await vi.importActual<ConfigModule>("@/web/Config");
    vi.doMock("@/web/Config", () => actual);
  });

  afterEach(() => {
    unmount?.();
    unmount = undefined;
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  /** Mounts the overlay window on the page with a config that has these widgets. */
  async function mountOverlay(widgets: Widget[]): Promise<FakeNode> {
    actual.updateConfig({ ...actual.defaultConfig(), widgets });
    const { init } = await import("@/web/i18n");
    const { default: overlay } = await import(
      "@/web/overlay/OverlayWindow.vue"
    );
    const app = createApp(overlay);
    app.use(await init("en"));
    const body = fakeNode("body");
    app.mount(body);
    unmount = () => app.unmount();
    await nextTick();
    return body;
  }

  /** Delivers a message from main and waits for the page to update. */
  async function receive<N extends IpcEvent["name"]>(
    name: N,
    payload: IpcEventPayload<N>,
  ) {
    mainEvents.dispatchEvent(new CustomEvent(name, { detail: payload }));
    await nextTick();
  }

  function widgetOf(config: Config, wmId: number): Widget {
    return present(config.widgets.find((w) => w.wmId === wmId));
  }

  /** Shows or hides a widget, as the widget manager does, and waits for the page to update. */
  async function setWants(wmId: number, wmWants: Widget["wmWants"]) {
    widgetOf(actual.AppConfig(), wmId).wmWants = wmWants;
    await nextTick();
  }

  /** Returns `shouldShow` of each OVERLAY->MAIN::render-state the page sent. */
  function renderStates(): boolean[] {
    return sent.flatMap((event) =>
      event.name === "OVERLAY->MAIN::render-state"
        ? [event.payload.shouldShow]
        : [],
    );
  }

  function savedConfigs(): Config[] {
    return sent.flatMap((event): Config[] =>
      event.name === "CLIENT->MAIN::save-config"
        ? [JSON.parse(event.payload.contents)]
        : [],
    );
  }

  function isDrawn(body: FakeNode, wmId: number): boolean {
    const element = present(
      descendants(body).find((node) => node.props.id === `widget-${wmId}`),
    );
    return element.style.display !== "none";
  }

  // Vitest names the class of a CSS module `_<name>_<hash>`
  function hasStashLayer(body: FakeNode): boolean {
    return descendants(body).some((node) =>
      String(node.props.class).startsWith("_layer_"),
    );
  }

  it("asks main to keep the window shown over the game while a widget without a blur flag is shown", async () => {
    const body = await mountOverlay(testWidgets([MENU]));
    await receive("MAIN->OVERLAY::focus-change", {
      game: false,
      overlay: true,
    });
    await setWants(XP_TRACKER, "show");

    await receive("MAIN->OVERLAY::focus-change", {
      game: true,
      overlay: false,
    });

    expect(renderStates()).toEqual([false, true]);
    expect(isDrawn(body, XP_TRACKER)).toBe(true);

    await setWants(XP_TRACKER, "hide");

    expect(renderStates()).toEqual([false, true, false]);
    expect(isDrawn(body, XP_TRACKER)).toBe(false);
  });

  it("draws an invisible-on-blur widget only while the overlay is active, and keeps it shown for the next time", async () => {
    const body = await mountOverlay(testWidgets([MENU]));
    expect(renderStates()).toEqual([false]);
    expect(isDrawn(body, MENU)).toBe(false);

    await receive("MAIN->OVERLAY::focus-change", {
      game: false,
      overlay: true,
    });
    expect(renderStates()).toEqual([false, true]);
    expect(isDrawn(body, MENU)).toBe(true);

    await receive("MAIN->OVERLAY::focus-change", {
      game: true,
      overlay: false,
    });
    expect(renderStates()).toEqual([false, true, false]);
    expect(isDrawn(body, MENU)).toBe(false);
    expect(widgetOf(actual.AppConfig(), MENU).wmWants).toBe("show");
  });

  it("hides a hide-on-blur widget when the overlay loses focus, so it stays hidden when the overlay is active again", async () => {
    const body = await mountOverlay(testWidgets([MENU]));
    await receive("MAIN->OVERLAY::focus-change", {
      game: false,
      overlay: true,
    });
    await setWants(PRICE_CHECK, "show");
    expect(isDrawn(body, PRICE_CHECK)).toBe(true);
    expect(isDrawn(body, MENU)).toBe(false);

    await receive("MAIN->OVERLAY::focus-change", {
      game: true,
      overlay: false,
    });
    expect(renderStates()).toEqual([false, true, false]);
    expect(isDrawn(body, PRICE_CHECK)).toBe(false);

    await receive("MAIN->OVERLAY::focus-change", {
      game: false,
      overlay: true,
    });
    expect(isDrawn(body, PRICE_CHECK)).toBe(false);
    expect(isDrawn(body, MENU)).toBe(true);
  });

  it("removes the stash layer and hides the widgets while Alt hides the overlay, and asks main to hide the window", async () => {
    const body = await mountOverlay(
      testWidgets([MENU, XP_TRACKER], { enabled: true, alignmentView: true }),
    );
    await receive("MAIN->OVERLAY::focus-change", {
      game: true,
      overlay: false,
    });
    expect(renderStates()).toEqual([true]);
    expect(hasStashLayer(body)).toBe(true);
    expect(isDrawn(body, XP_TRACKER)).toBe(true);

    await receive("MAIN->OVERLAY::visibility", { isVisible: false });
    expect(renderStates()).toEqual([true, false]);
    expect(hasStashLayer(body)).toBe(false);
    expect(isDrawn(body, XP_TRACKER)).toBe(false);

    await receive("MAIN->OVERLAY::visibility", { isVisible: true });
    expect(renderStates()).toEqual([true, false, true]);
    expect(hasStashLayer(body)).toBe(true);
    expect(isDrawn(body, XP_TRACKER)).toBe(true);
  });

  it("saves the config with its changes when the window loses focus", async () => {
    await mountOverlay(testWidgets([MENU]));
    actual.AppConfig().overlayKey = "Alt + Space";
    expect(savedConfigs()).toEqual([]);

    page.dispatchEvent(new Event("blur"));
    await nextTick();

    expect(savedConfigs().map((config) => config.overlayKey)).toEqual([
      "Alt + Space",
    ]);
  });

  it("saves the config when the price check closes, since no save runs while it is shown", async () => {
    await mountOverlay(testWidgets([MENU, PRICE_CHECK]));
    actual.AppConfig().overlayKey = "Alt + Space";
    page.dispatchEvent(new Event("blur"));
    await nextTick();
    expect(savedConfigs()).toEqual([]);

    await setWants(PRICE_CHECK, "hide");

    const saved = savedConfigs();
    expect(saved.map((config) => config.overlayKey)).toEqual(["Alt + Space"]);
    expect(widgetOf(saved[0], PRICE_CHECK).wmWants).toBe("hide");
  });
});
