import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [
    tsconfigPaths(),
    // Template URLs such as /images/divine.png stay strings, since Vitest cannot import the files of public/
    vue({ template: { transformAssetUrls: false } }),
  ],
  test: {
    globals: true,
    setupFiles: ["./specs/vitest.setup.ts"],
    coverage: {
      include: ["src/**/*.ts"],
      reporter: ["text-summary"],
      // The floor CI checks with --coverage; raise a number when the tests cover more
      thresholds: {
        statements: 88.5,
        branches: 81.2,
        functions: 93.5,
        lines: 88.9,
      },
    },
  },
});
