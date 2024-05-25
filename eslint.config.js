import { config } from "@susisu/eslint-config";
import vitestPlugin from "eslint-plugin-vitest";
import globals from "globals";

export default config({}, [
  {
    plugins: {
      vitest: vitestPlugin,
    },
  },
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      globals: {
        ...globals.es2021,
      },
    },
  },
  {
    files: ["src/**/*.test.ts"],
    rules: {
      ...vitestPlugin.configs.recommended.rules,
    },
  },
  {
    files: ["*.js"],
    languageOptions: {
      globals: {
        ...globals.es2021,
        ...globals.node,
      },
    },
  },
]);
