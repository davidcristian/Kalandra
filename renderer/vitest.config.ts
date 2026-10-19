import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    includeSource: ["src/**/*.{js,ts}"],
    globals: true,
    setupFiles: ["./specs/vitest.setup.ts"],
    coverage: {
      include: ["src/**/*.ts"],
      exclude: ["*.vue"],
      reporter: ["text-summary"],
      // The floor CI checks with --coverage; raise a number when the tests cover more
      thresholds: {
        statements: 46.7,
        branches: 38.8,
        functions: 50.2,
        lines: 46.7,
      },
    },
  },
  define: {
    "import.meta.vitest": "undefined",
  },
  resolve: {
    alias: {
      "@/assets/data/en": "./src/parser/en",
    },
  },
});
