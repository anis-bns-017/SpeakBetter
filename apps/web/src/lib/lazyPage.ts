// apps/web/src/lib/lazyPage.ts
// Pages are downloaded when they are first opened, not all at once with the app. If a page's file can't be
// fetched, it is tried once more (a flaky connection); if that fails too, the app reloads once, because after a
// new version is deployed the old file names no longer exist. A second failure is shown by the error boundary.

import { lazy, type ComponentType } from "react";

const RELOADED_KEY = "sb.chunkReload";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** True for the errors browsers give when a split-off file can't be loaded */
export function isChunkLoadError(error: unknown): boolean {
  const text = `${(error as Error)?.name ?? ""} ${(error as Error)?.message ?? ""}`;
  return /dynamically imported module|Importing a module script failed|error loading dynamically imported|ChunkLoadError|Loading chunk .* failed|Failed to fetch/i.test(text);
}

/** Reloads the page once per session; returns false if it already did (so the caller shows the error instead) */
export function reloadOnceForNewVersion(): boolean {
  try {
    if (sessionStorage.getItem(RELOADED_KEY)) return false;
    sessionStorage.setItem(RELOADED_KEY, "1");
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}

async function load<T>(loader: () => Promise<T>): Promise<T> {
  try {
    return await loader();
  } catch (first) {
    if (!isChunkLoadError(first)) throw first;
    await wait(800);
    try {
      return await loader();
    } catch (second) {
      // Keeps the page waiting while it reloads, instead of flashing an error
      if (reloadOnceForNewVersion()) return new Promise<T>(() => {});
      throw second;
    }
  }
}

/** A page loaded on first visit: `lazyPage(() => import("../pages/X"), "XPage")` (or "default") */
export function lazyPage<M extends Record<string, unknown>, K extends keyof M & string>(loader: () => Promise<M>, name: K) {
  const component = lazy(async () => {
    const module = await load(loader);
    // A good load means the current version works: allow a reload again after the next deploy
    try {
      sessionStorage.removeItem(RELOADED_KEY);
    } catch {
      /* ignore */
    }
    return { default: module[name] as ComponentType<object> };
  });
  return Object.assign(component, { preload: () => load(loader).catch(() => undefined) });
}
