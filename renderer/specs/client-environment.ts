import type { Environment } from "vitest/environments";

/** Runs a spec in Node with the modules built for the browser, so a component has its client render function. */
export default {
  name: "node-client",
  viteEnvironment: "client",
  setup: () => ({ teardown: () => {} }),
} satisfies Environment;
