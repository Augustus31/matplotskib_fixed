import js from "@eslint/js";
import globals from "globals";

export default [
  js.configs.recommended,
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: globals.browser,
    },
  },
  {
    files: ["test/**/*.js", "e2e/**/*.js", "eslint.config.js"],
    languageOptions: { globals: globals.node },
  },
];
