import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import prettierConfig from "eslint-config-prettier";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  prettierConfig,
  {
    rules: {
      // A single `a ? b : c` reads fine; a ternary inside a ternary does not.
      // The blanket `no-ternary` ban tried first (PR #10) turned every one-line
      // default into five lines of `let` + `if`, which was worse, not cleaner.
      "no-nested-ternary": "error",
      // `(await import("x")).fn(...)` and friends hide a module load inside an
      // expression. A lazy import is sometimes right (an optional package that
      // should not load on the plain path) — give it a named loader function
      // where it is the whole statement, so the laziness is visible.
      "no-restricted-syntax": [
        "error",
        {
          selector: "MemberExpression > AwaitExpression > ImportExpression",
          message:
            "Don't reach into a dynamic import inline — destructure it in its own statement.",
        },
        {
          selector: "CallExpression > AwaitExpression > ImportExpression",
          message: "Don't pass a dynamic import as an argument — load it in its own statement.",
        },
        {
          selector: "ConditionalExpression ImportExpression",
          message: "Don't hide a dynamic import inside a ternary — use a named loader function.",
        },
      ],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/consistent-type-assertions": [
        "error",
        { assertionStyle: "as", objectLiteralTypeAssertions: "allow-as-parameter" },
      ],
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
    },
  },
  {
    // Tests build partial fixtures on purpose; a fixture cast is the honest tool there.
    files: ["**/*.test.ts", "**/*.test.tsx"],
    rules: {
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/consistent-type-assertions": "off",
    },
  },
  {
    ignores: [".next/**", ".next-sim/**", "data/**", "runs/**", "node_modules/**"],
  }
);
