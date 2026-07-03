import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/__integration__/**/*.test.ts"],
    environment: "node",
    globals: true,
    sequence: { concurrent: false },
    testTimeout: 15000,
    hookTimeout: 15000,
  },
});
