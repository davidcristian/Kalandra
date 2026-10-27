import path from "path";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { CONTENT_SECURITY_POLICY } from "./content-security-policy.ts";

// https://vite.dev/config/
export default defineConfig({
  build: {
    target: "esnext",
    assetsInlineLimit: 0,
    sourcemap: true,
  },
  optimizeDeps: {
    rolldownOptions: { transform: { target: "esnext" } },
  },
  plugins: [
    vue({
      template: {
        compilerOptions: {
          isCustomElement: (tag: string) => tag === "webview",
        },
      },
    }),
  ],
  resolve: {
    alias: [
      { find: "@", replacement: path.resolve(import.meta.dirname, "./src") },
      {
        find: "@ipc",
        replacement: path.resolve(import.meta.dirname, "./src/../../ipc"),
      },
      {
        find: "@specs",
        replacement: path.resolve(import.meta.dirname, "./specs"),
      },
      // require("vue") in vuedraggable resolves to vue's CommonJS build, which adds the
      // template compiler; this keeps it on the runtime build the app imports
      { find: /^vue$/, replacement: "vue/dist/vue.runtime.esm-bundler.js" },
    ],
    extensions: [".ts", ".js", ".vue", ".json"],
  },
  server: {
    headers: { "content-security-policy": CONTENT_SECURITY_POLICY },
    proxy: {
      "^/(config|uploads|proxy)": { target: "http://127.0.0.1:8584" },
      "/events": { ws: true, target: "http://127.0.0.1:8584" },
    },
  },
});
