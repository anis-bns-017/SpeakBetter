// apps/mobile/src/links.ts
// What the web view does with a navigation. Kept apart from the screen so it can be tested on its own.

export type LinkAction = "stay" | "open" | "ignore";

/** The only kinds of link handed to the phone. Other schemes could launch any installed app from a chat link. */
const OPENS_OUTSIDE = /^(https?|mailto|tel):/i;

/**
 * "stay": load it in the app. "open": hand it to the phone's browser, mail or dialer. "ignore": do nothing.
 * `isTopFrame` is only reported on iOS, so undefined means the page itself.
 */
export function linkAction(url: string, origin: string | null, isTopFrame?: boolean): LinkAction {
  const lower = url.toLowerCase();
  if (lower.startsWith("about:") || lower.startsWith("blob:")) return "stay";
  // A whole page written into a link has no address to check, so it never replaces the app
  if (lower.startsWith("data:")) return isTopFrame === false ? "stay" : "ignore";
  // The exact site: "https://app.example.evil.com" must not pass as "https://app.example"
  if (origin && (lower === origin || ["/", "?", "#"].some((next) => lower.startsWith(origin + next)))) return "stay";
  // Something embedded in a page must not throw the learner out to another app
  if (isTopFrame === false) return "ignore";
  return OPENS_OUTSIDE.test(url) ? "open" : "ignore";
}
