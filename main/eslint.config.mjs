import { defineConfig } from "eslint/config";
import { neostandard } from "neostandard";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";

// The files that broke a rule when it was turned on, by rule. The lists only shrink: fix a file, then remove it.
const existingOffenders = {
  "@typescript-eslint/no-floating-promises": [
    "src/AppTray.ts",
    "src/AppUpdater.ts",
    "src/host-files/ConfigStore.ts",
    "src/main.ts",
    "src/shortcuts/Shortcuts.ts",
    "src/windowing/OverlayWindow.ts",
  ],
  "@typescript-eslint/no-misused-promises": [
    "src/AppUpdater.ts",
    "src/host-files/FileWriter.ts",
    "src/main.ts",
    "src/server.ts",
  ],
  "no-empty": ["src/host-files/ConfigStore.ts", "src/vision/link-main.ts"],
  "@typescript-eslint/no-non-null-assertion": [
    "specs/AppTray.test.ts",
    "specs/ocr-worker-body.test.ts",
    "specs/overlay-window.test.ts",
    "src/AppTray.ts",
    "src/proxy.ts",
    "src/server.ts",
    "src/vision/link-worker.ts",
    "src/vision/wasm-bindings.ts",
    "src/windowing/OverlayWindow.ts",
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

export default defineConfig(
  neostandard({ ts: true }),
  tseslint.configs.strict,
  prettier,

  {
    rules: {
      "no-console": ["error", { allow: ["warn", "error"] }],
      "no-debugger": process.env.NODE_ENV === "production" ? "warn" : "off",
      "@stylistic/quote-props": ["error", "consistent-as-needed"],
      "no-labels": ["error", { allowLoop: true }],
      "no-var": "error",
      "object-shorthand": ["error", "properties"],
      "dot-notation": "error",
      "n/no-deprecated-api": "error",
      "@typescript-eslint/no-invalid-void-type": "off",
      // A void statement marks a promise left to run on its own, which no-floating-promises accepts
      "no-void": ["error", { allowAsStatement: true }],
      "@typescript-eslint/no-explicit-any": "error",
      "no-empty": ["error", { allowEmptyCatch: false }],
      "no-restricted-syntax": ["error", castThroughUnknown, emptyCatchHandler],
    },
  },

  {
    files: ["**/*.ts"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "camelcase": "off",
      "@typescript-eslint/naming-convention": [
        "error",
        {
          selector: "variableLike",
          leadingUnderscore: "allow",
          trailingUnderscore: "allow",
          format: ["camelCase", "PascalCase", "UPPER_CASE"],
        },
      ],
      "@typescript-eslint/adjacent-overload-signatures": "error",
      "@typescript-eslint/array-type": ["error", { default: "array-simple" }],
      "@typescript-eslint/ban-tslint-comment": "error",
      "@typescript-eslint/consistent-generic-constructors": [
        "error",
        "constructor",
      ],
      "@typescript-eslint/consistent-type-definitions": ["error", "interface"],
      "@typescript-eslint/method-signature-style": "error",
      "@typescript-eslint/prefer-function-type": "error",
      "@typescript-eslint/triple-slash-reference": [
        "error",
        { lib: "never", path: "never", types: "never" },
      ],

      "@typescript-eslint/await-thenable": "error",
      "dot-notation": "off",
      "@typescript-eslint/dot-notation": "error",
      "@typescript-eslint/no-base-to-string": "error",
      "@typescript-eslint/no-confusing-void-expression": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-for-in-array": "error",
      "@typescript-eslint/no-implied-eval": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/only-throw-error": "error",
      "@typescript-eslint/no-unnecessary-boolean-literal-compare": "error",
      "@typescript-eslint/no-unnecessary-type-assertion": "error",
      "@typescript-eslint/prefer-includes": "error",
      "@typescript-eslint/promise-function-async": "error",
      "@typescript-eslint/require-array-sort-compare": [
        "error",
        { ignoreStringArrays: true },
      ],
      "@typescript-eslint/restrict-plus-operands": [
        "error",
        { skipCompoundAssignments: false },
      ],
      "@typescript-eslint/return-await": ["error", "always"],
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
  // The build script prints its progress to the terminal
  {
    files: ["build/*.mjs"],
    rules: { "no-console": "off" },
  },
);
