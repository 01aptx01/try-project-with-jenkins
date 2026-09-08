import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["**/node_modules/**", "**/dist/**", "**/.next/**", "**/coverage/**", "**/generated/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { files: ["**/*.{ts,tsx}"], languageOptions: { globals: { ...globals.node, ...globals.browser, ...globals.vitest } }, rules: { "@typescript-eslint/no-explicit-any": "error" } }
);
