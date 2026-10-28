import { configDefaults, defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";
import tsconfigPaths from "vite-tsconfig-paths";

// A spec that mounts a component with Vue's client renderer, which needs the component built for the browser
const CLIENT_SPECS = "specs/**/*.client.test.ts";

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
        statements: 91.2,
        branches: 85.1,
        functions: 95.3,
        lines: 91.8,
      },
    },
    projects: [
      {
        extends: true,
        test: {
          name: "node",
          exclude: [...configDefaults.exclude, CLIENT_SPECS],
        },
      },
      {
        extends: true,
        test: {
          name: "client",
          include: [CLIENT_SPECS],
          environment: "./specs/client-environment.ts",
        },
      },
    ],
  },
});
