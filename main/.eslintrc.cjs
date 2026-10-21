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
  "@typescript-eslint/no-explicit-any": [
    "src/vision/utils.ts",
    "src/vision/wasm-bindings.ts",
  ],
  "no-empty": [
    "src/host-files/ConfigStore.ts",
    "src/host-files/utils.ts",
    "src/vision/link-main.ts",
  ],
};

const castThroughUnknown = {
  selector:
    ":matches(TSAsExpression, TSTypeAssertion) > :matches(TSAsExpression, TSTypeAssertion).expression > TSUnknownKeyword.typeAnnotation",
  message:
    "A cast through unknown skips the type check, so fix the types instead.",
};
const emptyCatchHandler = {
  selector:
    'CallExpression[callee.property.name="catch"] > :function.arguments[body.type="BlockStatement"][body.body.length=0]',
  message:
    "An empty .catch() handler drops the error, so log it or pass it on.",
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
    "@typescript-eslint/no-explicit-any": "error",
    "no-empty": ["error", { allowEmptyCatch: false }],
    "no-restricted-syntax": ["error", castThroughUnknown, emptyCatchHandler],
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
    // Files that broke one restricted pattern when it was turned on, checked for the other; this list only shrinks too
    {
      files: ["src/shortcuts/Shortcuts.ts"],
      rules: { "no-restricted-syntax": ["error", castThroughUnknown] },
    },
  ],
};
