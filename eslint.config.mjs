import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettierConfig from "eslint-config-prettier";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettierConfig,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "node_modules/**",
    "prisma/migrations/**",
    "mobile/**",
    "mobile-flutter/**",
    "e2e/**",
    "scripts/**",
    "coverage/**",
  ]),
  // Test files: allow `any` and `require()`
  {
    files: ["__tests__/**"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  // CJS config files: allow `require()`
  {
    files: ["server.js", "jest.config.js", "jest.setup.js"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  // Downgrade react-hooks/set-state-in-effect to warn:
  // Data fetching on mount is a valid pattern, and the rule
  // conflicts with --fix removing eslint-disable comments.
  {
    rules: {
      "react-hooks/set-state-in-effect": "warn",
    },
  },
]);

export default eslintConfig;
