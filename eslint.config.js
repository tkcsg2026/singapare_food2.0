import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "node_modules",
      // Next.js build output. The old "dist" entry is a leftover from the Vite
      // template — nothing is emitted there, so generated bundles under .next
      // were being linted and reported thousands of errors nobody can fix.
      ".next",
      "dist",
      "out",
      "next-env.d.ts",
      // Stale copy of the whole project extracted from singapore_food2.0.zip.
      // Linting it duplicates every finding against files that are never built.
      "singapare_food2.0",
    ],
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
);
