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
    // DEV_LAN=1 opens the dev server to this Wi-Fi network, to try the site or the phone app on a real phone.
    // Off by default: anyone on the network can reach it while it's on.
    server: { port, strictPort: true, host: env.DEV_LAN === "1" ? true : undefined },
    build: {
      rolldownOptions: {
        output: {
          // Pages are split per route (src/lib/lazyPage.ts). Without these groups every icon became its own tiny
          // file (47 requests on first load); grouped, it is about 11, and the libraries file stays cached across
          // releases because it rarely changes.
          codeSplitting: {
            groups: [
              { name: "icons", test: /node_modules[\\/]lucide-react/ },
              {
                name: "vendor",
                test: /node_modules[\\/](react|react-dom|react-router|@tanstack|framer-motion|motion-dom|motion-utils|sonner|axios)[\\/]/,
              },
            ],
          },
        },
      },
    },
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
