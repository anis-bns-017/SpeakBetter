// apps/mobile/scripts/mobile-packages.cjs
// The pnpm store folders (node_modules/.pnpm/<name@version>) that the phone app's dependencies live in, found by
// following apps/mobile/node_modules and each package's own node_modules links. metro.config.js watches only these,
// instead of the whole store shared with the web app and the server (several times larger, and slow to scan).
const fs = require("node:fs");
const path = require("node:path");

const STORE_MARK = `${path.sep}.pnpm${path.sep}`;

/** The .pnpm/<entry> folder a real package path lives in, or null when it isn't in the store */
function storeEntry(realPath) {
  const at = realPath.indexOf(STORE_MARK);
  if (at < 0) return null;
  const rest = realPath.slice(at + STORE_MARK.length);
  return realPath.slice(0, at + STORE_MARK.length) + rest.split(path.sep)[0];
}

/** Package folders inside a node_modules folder (scoped ones included) */
function packagesIn(nodeModules) {
  let names;
  try {
    names = fs.readdirSync(nodeModules);
  } catch {
    return [];
  }
  const found = [];
  for (const name of names) {
    if (name.startsWith(".")) continue;
    const full = path.join(nodeModules, name);
    if (name.startsWith("@")) {
      try {
        for (const inner of fs.readdirSync(full)) found.push(path.join(full, inner));
      } catch {
        /* not a folder */
      }
    } else {
      found.push(full);
    }
  }
  return found;
}

function mobileStoreEntries(projectRoot) {
  const entries = new Set();
  const queue = [path.join(projectRoot, "node_modules")];
  const seenNodeModules = new Set();
  while (queue.length) {
    const nodeModules = queue.pop();
    if (seenNodeModules.has(nodeModules)) continue;
    seenNodeModules.add(nodeModules);
    for (const pkg of packagesIn(nodeModules)) {
      let real;
      try {
        real = fs.realpathSync(pkg);
      } catch {
        continue;
      }
      const entry = storeEntry(real);
      if (!entry || entries.has(entry)) continue;
      entries.add(entry);
      // A store entry's node_modules holds the package and links to its own dependencies
      queue.push(path.join(entry, "node_modules"));
    }
  }
  return [...entries].sort();
}

module.exports = { mobileStoreEntries };

if (require.main === module) {
  const root = path.resolve(__dirname, "..");
  const mine = mobileStoreEntries(root);
  const all = fs.readdirSync(path.resolve(root, "../../node_modules/.pnpm")).filter((n) => !n.startsWith("."));
  console.log(`phone app uses ${mine.length} of ${all.length} store folders`);
}
