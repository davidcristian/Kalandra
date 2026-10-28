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
        statements: 89.6,
        branches: 82.9,
        functions: 94.3,
        lines: 90.1,
      },
    },
  },
});
