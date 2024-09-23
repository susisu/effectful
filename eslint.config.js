import { config } from "@susisu/eslint-config";
import vitestPlugin from "@vitest/eslint-plugin";
import globals from "globals";

export default config({ tsconfigRootDir: import.meta.dirname }, [
  {},
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
    plugins: {
      vitest: vitestPlugin,
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
