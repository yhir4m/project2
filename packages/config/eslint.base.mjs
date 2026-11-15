import js from "@eslint/js";
import tseslint from "typescript-eslint";

/** Configuración ESLint compartida para paquetes TypeScript sin UI. */
export default tseslint.config(
  { ignores: ["dist/**", "coverage/**", "**/*.d.ts"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/consistent-type-imports": "error",
    },
  },
);
