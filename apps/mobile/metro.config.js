// apps/mobile/metro.config.js
// Expo's default Metro setup, narrowed to what the phone app uses: this folder and the installed libraries.
//
// In a monorepo Expo makes Metro crawl and watch every workspace (the server, the web app, all of packages/).
// On this machine that took minutes, and while the server rebuilt dist/ and Prisma rewrote its client, watching
// those folders could fail. Metro then never finished its file index and answered every request with
// "Cannot read properties of undefined (reading 'get')" in DependencyGraph.js. The app is a web view and imports
// nothing from the other workspaces, so Metro only needs:
//   - apps/mobile itself (the project root, always watched)
//   - the pnpm store folders of the app's own libraries (scripts/mobile-packages.cjs): about a third of the
//     store shared with the web app and the server
const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");
const { mobileStoreEntries } = require("./scripts/mobile-packages.cjs");

const config = getDefaultConfig(__dirname);
const root = path.resolve(__dirname, "../..");

const storeEntries = mobileStoreEntries(__dirname);
// Fall back to the whole store if the links can't be read (e.g. before the first install)
config.watchFolders = storeEntries.length ? storeEntries : [path.join(root, "node_modules")];

// Belt and braces: never resolve into the other parts of the repository even if something points there
const SEP = "[\\\\/]"; // either slash, so the rules work on Windows and elsewhere
const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const pattern = (absolute) => absolute.split(/[\\/]/).map(escape).join(SEP);
const SKIPPED = ["server", "apps/web", "docs", "design-system", ".claude", ".playwright-mcp", ".turbo"];
const skipped = SKIPPED.map((dir) => new RegExp(`^${pattern(path.join(root, dir))}(${SEP}.*)?$`));

const existing = config.resolver.blockList;
config.resolver.blockList = [...(Array.isArray(existing) ? existing : existing ? [existing] : []), ...skipped];

module.exports = config;
