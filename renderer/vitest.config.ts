import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    setupFiles: ["./specs/vitest.setup.ts"],
    coverage: {
      include: ["src/**/*.ts"],
      reporter: ["text-summary"],
      // The floor CI checks with --coverage; raise a number when the tests cover more
      thresholds: {
        statements: 70.6,
        branches: 65.8,
        functions: 73.8,
        lines: 70.7,
      },
    },
  },
});
