// scripts/livekit.mjs (pnpm livekit)
// Starts or restarts LiveKit, the voice server for rooms and calls, in Docker (docker-compose.yml). It tells LiveKit
// this computer's Wi-Fi or Ethernet address, so browsers on this computer and phones on the same Wi-Fi can send
// voice to it. Run it again when that address changes (another network, or a new one from the router).
//
//   LIVEKIT_NODE_IP=192.168.1.20 pnpm livekit   picks the address yourself
import { networkInterfaces } from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const PRIVATE = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/;
/** Adapters that Windows, WSL, Docker or VM software add; phones can't reach these */
const VIRTUAL = /vEthernet|WSL|Hyper-V|VirtualBox|VMware|docker|Loopback|br-|veth|utun|vboxnet/i;

function networkAddress() {
  const found = [];
  for (const [name, addresses] of Object.entries(networkInterfaces())) {
    for (const a of addresses ?? []) {
      if (a.family !== "IPv4" || a.internal || !PRIVATE.test(a.address)) continue;
      found.push({ name, address: a.address, score: (VIRTUAL.test(name) ? 0 : 2) + (a.address.startsWith("192.168.") ? 1 : 0) });
    }
  }
  return found.sort((a, b) => b.score - a.score)[0] ?? null;
}

const chosen = process.env.LIVEKIT_NODE_IP
  ? { name: "LIVEKIT_NODE_IP", address: process.env.LIVEKIT_NODE_IP }
  : networkAddress();
const ip = chosen?.address ?? "127.0.0.1";
console.log(
  chosen
    ? `[livekit] Voice server will use ${ip} (${chosen.name}).`
    : "[livekit] No network found: voice will work on this computer only.",
);

const result = spawnSync("docker", ["compose", "up", "-d", "--no-deps", "--force-recreate", "livekit"], {
  cwd: fileURLToPath(new URL("..", import.meta.url)),
  stdio: "inherit",
  env: { ...process.env, LIVEKIT_NODE_IP: ip },
  shell: process.platform === "win32",
});
process.exit(result.status ?? 1);
