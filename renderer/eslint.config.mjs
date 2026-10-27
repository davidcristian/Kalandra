import pluginVue from "eslint-plugin-vue";
import {
  defineConfigWithVueTs,
  vueTsConfigs,
} from "@vue/eslint-config-typescript";
import { standard } from "@vue/eslint-config-standard-with-typescript";
import prettier from "eslint-config-prettier";

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

// https://github.com/vuejs/eslint-config-standard/pull/71
standard[standard.length - 1].files = ["**/*.ts", "**/*.vue"];

export default defineConfigWithVueTs(
  { ignores: ["src/*.d.ts"] },

  pluginVue.configs["flat/base"],
  vueTsConfigs.strict,
  standard,
  prettier,

  {
    files: ["**/*.vue"],
    rules: {
      "import-x/first": "off",
      "import-x/no-duplicates": "off",
      "vue/dot-notation": "off",
      "vue/quote-props": "off",
    },
  },

  {
    rules: {
      "no-console": ["error", { allow: ["warn", "error"] }],
      "no-debugger": process.env.NODE_ENV === "production" ? "warn" : "off",
      "@stylistic/quote-props": ["error", "consistent-as-needed"],
      "no-labels": ["error", { allowLoop: true }],
      "@stylistic/multiline-ternary": "off",
      "@typescript-eslint/strict-boolean-expressions": "off",
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/restrict-template-expressions": "off",
      "@typescript-eslint/prefer-nullish-coalescing": "off",
      "@typescript-eslint/prefer-optional-chain": "off",
      "@typescript-eslint/prefer-readonly": "off",
      "@typescript-eslint/prefer-reduce-type-parameter": "off",
      "@typescript-eslint/no-invalid-void-type": "off",
      "@typescript-eslint/consistent-indexed-object-style": "off",
      "@typescript-eslint/consistent-type-assertions": [
        "error",
        { assertionStyle: "as", objectLiteralTypeAssertions: "never" },
      ],
      "func-call-spacing": "off",
      "object-shorthand": "off",
      // A void statement marks a promise left to run on its own, which no-floating-promises accepts
      "no-void": ["error", { allowAsStatement: true }],
      "no-empty": ["error", { allowEmptyCatch: false }],
      "no-restricted-syntax": ["error", castThroughUnknown, emptyCatchHandler],
      "vue/require-valid-default-prop": "error",
    },
  },

  {
    files: ["**/*.ts", "**/*.vue"],
    rules: {
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
    },
  },

  {
    files: ["src/parser/**", "src/assets/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              regex: "^(@/web|(\\.\\./)+web)(/|$)",
              message:
                "The parser and the data loader import nothing from src/web/: the app passes them what they need at start.",
            },
          ],
        },
      ],
    },
  },
);
