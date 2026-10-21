// The files that broke a rule when it was turned on, by rule. The lists only shrink: fix a file, then remove it.
const existingOffenders = {
  "@typescript-eslint/no-floating-promises": [
    "src/AppTray.ts",
    "src/AppUpdater.ts",
    "src/host-files/ConfigStore.ts",
    "src/host-files/GameLogWatcher.ts",
    "src/main.ts",
    "src/shortcuts/Shortcuts.ts",
    "src/windowing/OverlayWindow.ts",
  ],
  "@typescript-eslint/no-misused-promises": [
    "src/AppUpdater.ts",
    "src/host-files/FileWriter.ts",
    "src/host-files/GameLogWatcher.ts",
    "src/main.ts",
    "src/server.ts",
  ],
};

module.exports = {
  root: true,
  env: {
    node: true,
  },
  plugins: [
    "@typescript-eslint",
    // 'only-warn'
  ],
  extends: ["standard-with-typescript", "prettier"],
  rules: {
    "no-console": process.env.NODE_ENV === "production" ? "warn" : "off",
    "no-debugger": process.env.NODE_ENV === "production" ? "warn" : "off",
    "quote-props": ["error", "consistent-as-needed"],
    "no-labels": ["error", { allowLoop: true }],
    "multiline-ternary": "off",
    "no-unused-vars": "off",
    "no-undef": "off",
    "@typescript-eslint/no-unused-vars": ["error"],
    "@typescript-eslint/strict-boolean-expressions": "off",
    "@typescript-eslint/no-non-null-assertion": "off",
    "@typescript-eslint/explicit-function-return-type": "off",
    "@typescript-eslint/restrict-template-expressions": "off",
    "@typescript-eslint/prefer-nullish-coalescing": "off",
    "@typescript-eslint/prefer-optional-chain": "off",
    "@typescript-eslint/prefer-readonly": "off",
    "@typescript-eslint/prefer-reduce-type-parameter": "off",
    "@typescript-eslint/no-invalid-void-type": "off",
    "@typescript-eslint/consistent-indexed-object-style": "off",
    "import/first": "off",
    "import/no-duplicates": "off",
    "func-call-spacing": "off",
    // TODO: refactor IPC and enable
    "@typescript-eslint/consistent-type-assertions": "off",
  },
  overrides: [
    {
      files: ["*.ts"],
      parserOptions: {
        project: "./tsconfig.json",
      },
    },
    ...Object.entries(existingOffenders).map(([rule, files]) => ({
      files,
      rules: { [rule]: "off" },
    })),
  ],
};
