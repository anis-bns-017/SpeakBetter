import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Tests run in a simulated browser (jsdom). Styling isn't loaded: tests check behaviour, not looks.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@speakbetter/types": fileURLToPath(new URL("../../packages/types/src/index.ts", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    css: false,
  },
});
