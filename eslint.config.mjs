import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import prettierConfig from "eslint-config-prettier";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  prettierConfig,
  {
    rules: {
      "no-ternary": "error",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    ignores: [
      ".next/**",
      ".next-sim/**",
      "data/**",
      "runs/**",
      "node_modules/**",
      // Legacy files created before style rules:
      "src/engine/**",
      "src/app/**",
      "src/db/**",
      "scripts/balance.ts",
      "scripts/brain-bench.ts",
      "scripts/doctor.ts",
      "scripts/public-check.ts",
      "scripts/scoreboard.ts",
      "scripts/tune.ts",
      "scripts/worldhash.ts",
      "src/actors/barn.ts",
      "src/actors/personas.ts",
    ],
  }
);
