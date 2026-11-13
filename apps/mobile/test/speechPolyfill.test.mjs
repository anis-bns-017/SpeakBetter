// apps/mobile/test/speechPolyfill.test.mjs
// Runs the page-side speech script (src/speechPolyfill.ts) in a fake web view and checks it behaves like
// Chrome's SpeechRecognition. Run: pnpm --filter mobile test
import { test } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import vm from "node:vm";

const src = fs.readFileSync(new URL("../src/speechPolyfill.ts", import.meta.url), "utf8");
const script = src.match(/String\.raw`([\s\S]*)`;/)[1];

function makeWindow() {
  const posted = [];
  const win = { ReactNativeWebView: { postMessage: (m) => posted.push(JSON.parse(m)) }, Event, EventTarget, DOMException, setTimeout, console };
  win.window = win;
  vm.createContext(win);
  vm.runInContext(script, win);
  return { win, posted };
}

test('defines SpeechRecognition and webkitSpeechRecognition', () => {
  const { win } = makeWindow();
  assert.strictEqual(typeof win.SpeechRecognition, 'function');
  assert.strictEqual(win.SpeechRecognition, win.webkitSpeechRecognition);
});

test('does nothing outside the app (no ReactNativeWebView)', () => {
  const win = { Event, EventTarget, DOMException };
  win.window = win;
  vm.createContext(win);
  vm.runInContext(script, win);
  assert.strictEqual(win.SpeechRecognition, undefined);
});

test('start sends the options; a second start throws', () => {
  const { win, posted } = makeWindow();
  const r = new win.SpeechRecognition();
  r.lang = 'en-GB';
  r.continuous = true;
  r.interimResults = true;
  r.maxAlternatives = 3;
  r.start();
  assert.deepStrictEqual(posted[0], { action: 'start', id: '1', options: { lang: 'en-GB', continuous: true, interimResults: true, maxAlternatives: 3 }, channel: 'sb-speech' });
  assert.throws(() => r.start(), /already started/);
});

test('interim then final results build a Chrome-like list', () => {
  const { win } = makeWindow();
  const r = new win.SpeechRecognition();
  r.interimResults = true;
  r.continuous = true;
  r.maxAlternatives = 2;
  const seen = [];
  r.onresult = (e) => {
    const parts = [];
    for (let i = e.resultIndex; i < e.results.length; i++) parts.push([e.results[i][0].transcript, e.results[i].isFinal, e.results[i].length]);
    seen.push({ index: e.resultIndex, length: e.results.length, parts });
  };
  r.start();
  win.__sbSpeech.emit('1', 'result', { isFinal: false, results: [{ transcript: 'hel', confidence: 0 }] });
  win.__sbSpeech.emit('1', 'result', { isFinal: true, results: [{ transcript: 'hello there', confidence: 0.9 }, { transcript: 'hello their', confidence: 0.5 }, { transcript: 'x', confidence: 0.1 }] });
  win.__sbSpeech.emit('1', 'result', { isFinal: false, results: [{ transcript: 'how', confidence: 0 }] });
  assert.deepStrictEqual(seen, [
    { index: 0, length: 1, parts: [['hel', false, 1]] },
    { index: 0, length: 1, parts: [['hello there', true, 2]] },
    { index: 1, length: 2, parts: [['how', false, 1]] },
  ]);
});

test('without interimResults only final results arrive', () => {
  const { win } = makeWindow();
  const r = new win.SpeechRecognition();
  let count = 0;
  r.onresult = () => count++;
  r.start();
  win.__sbSpeech.emit('1', 'result', { isFinal: false, results: [{ transcript: 'a' }] });
  win.__sbSpeech.emit('1', 'result', { isFinal: true, results: [{ transcript: 'a b' }] });
  assert.strictEqual(count, 1);
});

test('errors carry the code; end fires once and allows a restart', () => {
  const { win, posted } = makeWindow();
  const r = new win.SpeechRecognition();
  const events = [];
  r.onerror = (e) => events.push('error:' + e.error);
  r.addEventListener('end', () => events.push('end'));
  r.onstart = () => events.push('start');
  r.start();
  win.__sbSpeech.emit('1', 'start');
  win.__sbSpeech.emit('1', 'error', { error: 'no-speech', message: '' });
  win.__sbSpeech.emit('1', 'end');
  win.__sbSpeech.emit('1', 'end');
  assert.deepStrictEqual(events, ['start', 'error:no-speech', 'end']);
  r.start(); // allowed again after end
  assert.strictEqual(posted.length, 2);
});

test('stop and abort are sent only while running', () => {
  const { win, posted } = makeWindow();
  const r = new win.SpeechRecognition();
  r.stop();
  assert.strictEqual(posted.length, 0);
  r.start();
  r.stop();
  r.abort();
  assert.deepStrictEqual(posted.map((p) => p.action), ['start', 'stop', 'abort']);
});

test('two recognitions get separate events', () => {
  const { win } = makeWindow();
  const a = new win.SpeechRecognition();
  const b = new win.SpeechRecognition();
  let aEnd = 0;
  let bEnd = 0;
  a.onend = () => aEnd++;
  b.onend = () => bEnd++;
  a.start();
  b.start();
  win.__sbSpeech.emit('1', 'end');
  assert.deepStrictEqual([aEnd, bEnd], [1, 0]);
});

test('a throwing handler does not stop listeners', () => {
  const { win } = makeWindow();
  const r = new win.SpeechRecognition();
  let listener = 0;
  r.onstart = () => {
    throw new Error('page bug');
  };
  r.addEventListener('start', () => listener++);
  r.start();
  const orig = win.setTimeout;
  win.setTimeout = () => {}; // swallow the rethrow
  win.__sbSpeech.emit('1', 'start');
  win.setTimeout = orig;
  assert.strictEqual(listener, 1);
});

