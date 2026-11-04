import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => {
  // DEV_PORT in .env moves the dev server off 5173, for machines where Windows reserves that port
  const env = loadEnv(mode, process.cwd(), "");
  const port = Number(env.DEV_PORT) || 5173;

  return {
    plugins: [
      react(),
      tailwindcss(),
    ],
    server: { port, strictPort: true },
    resolve: {
      alias: {
        // Shared types live in the monorepo's packages/types
        "@speakbetter/types": fileURLToPath(
          new URL("../../packages/types/src/index.ts", import.meta.url),
        ),
      },
    },
  };
});
