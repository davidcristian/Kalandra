import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      include: ["src/**/*.ts"],
      reporter: ["text-summary"],
      // The floor CI checks with --coverage; raise a number when the tests cover more
      thresholds: {
        statements: 53.4,
        branches: 53.7,
        functions: 50.1,
        lines: 52.8,
      },
    },
  },
});
