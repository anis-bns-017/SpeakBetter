import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv, type ProxyOptions } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => {
  // DEV_PORT in .env moves the dev server off 5173, for machines where Windows reserves that port
  const env = loadEnv(mode, process.cwd(), "");
  const port = Number(env.DEV_PORT) || 5173;

  // Forwarding for a page opened over https through a tunnel (src/lib/api/serverUrl.ts, devProxyOrigin): the page
  // can't call the plain-http API and LiveKit itself, so the dev server passes their requests on. Sign-in cookies
  // then belong to the page's own address. The API only accepts known origins, so forwarded requests say they
  // come from this dev server, which is what they are.
  const apiTarget = new URL(env.VITE_API_URL || "http://localhost:3001").origin;
  const livekitTarget = (env.VITE_LIVEKIT_URL || "ws://localhost:18080").replace(/^ws/, "http");
  const asDevServer: ProxyOptions["configure"] = (proxy) => {
    const origin = `http://localhost:${port}`;
    proxy.on("proxyReq", (req) => {
      if (req.getHeader("origin")) req.setHeader("origin", origin);
    });
    proxy.on("proxyReqWs", (req) => {
      if (req.getHeader("origin")) req.setHeader("origin", origin);
    });
  };
  const proxy: Record<string, ProxyOptions> = {
    "/__api": { target: apiTarget, changeOrigin: true, rewrite: (path) => path.replace(/^\/__api/, ""), configure: asDevServer },
    "/socket.io": { target: apiTarget, changeOrigin: true, ws: true, configure: asDevServer },
    "/__livekit": { target: livekitTarget, changeOrigin: true, ws: true, rewrite: (path) => path.replace(/^\/__livekit/, "") },
  };

  return {
    plugins: [
      react(),
      tailwindcss(),
    ],
    // DEV_LAN=1 opens the dev server to this Wi-Fi network, to try the site or the phone app on a real phone.
    // Off by default: anyone on the network can reach it while it's on.
    // allowedHosts: the https tunnel addresses (pnpm --filter web tunnel) may reach it too.
    server: {
      port,
      strictPort: true,
      host: env.DEV_LAN === "1" ? true : undefined,
      allowedHosts: [".trycloudflare.com"],
      proxy,
    },
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
