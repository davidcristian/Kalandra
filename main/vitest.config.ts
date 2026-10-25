import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      include: ["src/**/*.ts"],
      reporter: ["text-summary"],
      // The floor CI checks with --coverage; raise a number when the tests cover more
      thresholds: {
        statements: 76.2,
        branches: 77.5,
        functions: 77.3,
        lines: 75.5,
      },
    },
  },
});
