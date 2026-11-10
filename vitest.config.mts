import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    exclude: ["smart-contracts/**", "node_modules/**", ".next/**"],
  },
});
