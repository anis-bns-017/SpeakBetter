// apps/mobile/scripts/phone-dev.mjs
// One command for testing on a real phone:  pnpm --filter mobile phone
//
//   1. starts a Cloudflare tunnel to the web dev server (https, so the phone may use the microphone),
//   2. checks the new address answers, then saves it in apps/mobile/.env.local,
//   3. starts Expo (cache cleared, so it reads that address) and keeps the tunnel alive while Expo runs.
//
// The tunnel address changes every run, which is why this does all three together. Stop with Ctrl+C: the tunnel
// is closed too. The web dev server (pnpm --filter web dev) and the API must already be running.
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const WEB_PORT = 15173;
const here = path.dirname(fileURLToPath(import.meta.url));
const mobileDir = path.resolve(here, "..");
const envFile = path.join(mobileDir, ".env.local");

const log = (msg) => console.log(`\n[phone] ${msg}`);

async function webServerIsUp() {
  try {
    const res = await fetch(`http://localhost:${WEB_PORT}/`, { signal: AbortSignal.timeout(4000) });
    return res.ok;
  } catch {
    return false;
  }
}

async function answers(url) {
  try {
    const res = await fetch(`${url}/`, { signal: AbortSignal.timeout(8000) });
    return res.ok;
  } catch {
    return false;
  }
}

if (!(await webServerIsUp())) {
  console.error(
    `\n[phone] The web dev server is not running on port ${WEB_PORT}.\nStart it first, in another terminal:  pnpm --filter web dev\n`,
  );
  process.exit(1);
}

log("Starting the https tunnel…");
const tunnel = spawn("cloudflared", ["tunnel", "--no-autoupdate", "--url", `http://localhost:${WEB_PORT}`], {
  stdio: ["ignore", "pipe", "pipe"],
  shell: true,
});

let expo = null;
const shutdown = (code = 0) => {
  try {
    expo?.kill();
  } catch {
    /* already gone */
  }
  try {
    tunnel.kill();
  } catch {
    /* already gone */
  }
  process.exit(code);
};
process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
tunnel.on("exit", (code) => {
  if (!expo) {
    console.error("\n[phone] The tunnel stopped before it was ready. Is cloudflared installed? (cloudflared --version)");
    process.exit(code ?? 1);
  }
  console.error("\n[phone] The tunnel stopped, so the phone can no longer reach the site. Run this command again.");
  shutdown(1);
});

const url = await new Promise((resolve) => {
  const onData = (chunk) => {
    const match = String(chunk).match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
    if (match) resolve(match[0]);
  };
  tunnel.stdout.on("data", onData);
  tunnel.stderr.on("data", onData);
});

log(`Tunnel address: ${url}`);
let ready = false;
for (let i = 0; i < 15 && !ready; i++) {
  ready = await answers(url);
  if (!ready) await new Promise((r) => setTimeout(r, 2000));
}
if (!ready) {
  console.error("\n[phone] The tunnel address did not answer in time. Run this command again.");
  shutdown(1);
}

writeFileSync(
  envFile,
  [
    "# Written by `pnpm --filter mobile phone` (development only, not committed).",
    "# The https tunnel to the web dev server, so the phone gets the microphone. It changes on every run.",
    `EXPO_PUBLIC_WEB_URL=${url}`,
    "",
  ].join("\n"),
);
log("Saved the address. Starting Expo (scan the QR code with Expo Go)…");

expo = spawn("npx", ["expo", "start", "--clear", "--go", "--offline"], { cwd: mobileDir, stdio: "inherit", shell: true });
expo.on("exit", (code) => shutdown(code ?? 0));
