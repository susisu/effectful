import { config } from "@susisu/eslint-config";
import vitestPlugin from "@vitest/eslint-plugin";
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
        ...globals.es2023,
      },
    },
  },
  {
    files: ["src/**/*.test.ts"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      ...vitestPlugin.configs.recommended.rules,
    },
  },
  {
    files: ["*.js"],
    languageOptions: {
      globals: {
        ...globals.es2023,
        ...globals.node,
      },
    },
  },
]);
