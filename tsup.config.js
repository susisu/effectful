import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  outDir: "./lib",
  format: ["esm"],
  splitting: false,
  sourcemap: true,
  dts: true,
  clean: true,
});
