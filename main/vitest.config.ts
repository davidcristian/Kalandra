import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      include: ["src/**/*.ts"],
      reporter: ["text-summary"],
      // The floor CI checks with --coverage; raise a number when the tests cover more
      thresholds: {
        statements: 73.4,
        branches: 73.4,
        functions: 75.2,
        lines: 72.9,
      },
    },
  },
});
