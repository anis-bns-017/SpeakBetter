// apps/mobile/test/links.test.mjs
// Which links stay in the app, which go to the phone, and which are refused. Run: pnpm --filter mobile test
import { test } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import { stripTypeScriptTypes } from "node:module";

const source = fs.readFileSync(new URL("../src/links.ts", import.meta.url), "utf8");
const { linkAction } = await import(`data:text/javascript,${encodeURIComponent(stripTypeScriptTypes(source))}`);
const ORIGIN = "https://app.speakbetter.example";

test("pages of the app stay in the app", () => {
  for (const url of [ORIGIN, `${ORIGIN}/`, `${ORIGIN}/voice/1`, `${ORIGIN}?a=1`, `${ORIGIN}#top`, "HTTPS://APP.SPEAKBETTER.EXAMPLE/chat", "about:blank", "blob:x"]) {
    assert.strictEqual(linkAction(url, ORIGIN), "stay", url);
  }
});

test("a look-alike address is not the app", () => {
  for (const url of [`${ORIGIN}.evil.com/login`, `${ORIGIN}evil.com`, "https://evil.com/?u=https://app.speakbetter.example"]) {
    assert.strictEqual(linkAction(url, ORIGIN), "open", url);
  }
});

test("web, mail and phone links open outside", () => {
  for (const url of ["https://example.com", "http://example.com", "mailto:a@example.com", "tel:+123"]) {
    assert.strictEqual(linkAction(url, ORIGIN), "open", url);
  }
});

test("other schemes and whole pages in a link are refused", () => {
  for (const url of ["intent://x#Intent;end", "javascript:alert(1)", "file:///etc/hosts", "otherapp://do", "data:text/html,<h1>x</h1>"]) {
    assert.strictEqual(linkAction(url, ORIGIN), "ignore", url);
  }
});

test("embedded content never leaves the app", () => {
  assert.strictEqual(linkAction("https://example.com/frame", ORIGIN, false), "ignore");
  assert.strictEqual(linkAction("data:text/html,x", ORIGIN, false), "stay");
  assert.strictEqual(linkAction(`${ORIGIN}/frame`, ORIGIN, false), "stay");
});
