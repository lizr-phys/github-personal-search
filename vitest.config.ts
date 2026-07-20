import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const base = {
  environment: "node" as const,
  setupFiles: ["./tests/setup.ts"],
  coverage: {
    reporter: ["text", "html"]
  }
};

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) }
  },
  test: {
    ...base,
    include: ["tests/**/*.test.ts"],
    testTimeout: 20_000
  }
});
