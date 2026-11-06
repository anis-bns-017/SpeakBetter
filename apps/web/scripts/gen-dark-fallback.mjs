// apps/web/scripts/gen-dark-fallback.mjs
//
// Writes src/styles/dark-fallback.css: a dark version of every light-only colour class the app uses.
// Many older screens were built light-only (bg-white, text-slate-900, border-slate-200, bg-indigo-50 ...).
// In the dark and navy themes these rules repaint them, but only on elements that do not bring their own
// dark: style for that property, so screens that were designed for dark mode are left exactly as they are.
//
// Run it again after adding screens:  pnpm --filter web theme:fallback

import { readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(root, 'src');
const OUT = join(SRC, 'styles', 'dark-fallback.css');

const NEUTRAL = ['slate', 'gray', 'zinc', 'neutral', 'stone'];
const HUES = ['red', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald', 'teal', 'cyan', 'sky', 'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose'];
const STATES = { '': '', 'hover:': ':hover', 'focus:': ':focus' };

const white = (pct) => `color-mix(in oklab, white ${pct}%, transparent)`;
const tint = (hue, pct) => `color-mix(in oklab, var(--color-${hue}-500) ${pct}%, transparent)`;
const shade = (hue, n) => `var(--color-${hue}-${n})`;
const SURFACE = 'var(--sb-surface)';
const SURFACE_2 = 'var(--sb-surface-2)';

/** The dark value for one light utility, or null to leave it alone */
function darkValue(prop, color, n, alpha) {
  const gradient = prop === 'from' || prop === 'via' || prop === 'to';
  if (color === 'white' || color === 'black') {
    if (color === 'black') return prop === 'text' ? shade('slate', 100) : null;
    if (prop === 'text') return null; // white text sits on colour; keep it
    if (alpha !== undefined) {
      if (prop === 'bg' || gradient) return `color-mix(in oklab, ${SURFACE} ${alpha}%, transparent)`;
      return white(Math.max(4, Math.round(alpha / 5)));
    }
    return SURFACE;
  }
  if (alpha !== undefined) {
    // bg-slate-50/50, border-indigo-200/60 ...: the same dark colour at the same opacity
    const base = darkValue(prop, color, n, undefined);
    return base ? `color-mix(in oklab, ${base} ${alpha}%, transparent)` : null;
  }

  if (NEUTRAL.includes(color)) {
    // Neutral greys all follow the slate scale, so the navy palette reaches them too
    if (prop === 'bg' || gradient) return { 50: SURFACE_2, 100: white(6), 200: white(10), 300: white(16) }[n] ?? null;
    if (prop === 'text') return { 950: shade('slate', 100), 900: shade('slate', 100), 800: shade('slate', 100), 700: shade('slate', 200), 600: shade('slate', 300), 500: shade('slate', 400), 400: shade('slate', 500) }[n] ?? null;
    if (prop === 'border' || prop === 'divide') return { 50: white(6), 100: white(6), 200: white(9), 300: white(14), 400: white(22) }[n] ?? null;
    if (prop === 'ring') return { 100: white(8), 200: white(10), 300: white(16) }[n] ?? null;
    return null;
  }

  // Coloured tints become glows of the same hue; dark coloured text becomes light
  if (prop === 'bg') return { 50: tint(color, 10), 100: tint(color, 16), 200: tint(color, 24) }[n] ?? null;
  if (gradient) return { 50: tint(color, 10), 100: tint(color, 14), 200: tint(color, 20) }[n] ?? null;
  if (prop === 'text') return { 600: shade(color, 400), 700: shade(color, 300), 800: shade(color, 200), 900: shade(color, 200), 950: shade(color, 200) }[n] ?? null;
  if (prop === 'border' || prop === 'divide') return { 100: tint(color, 20), 200: tint(color, 28), 300: tint(color, 36) }[n] ?? null;
  if (prop === 'ring') return { 100: tint(color, 28), 200: tint(color, 36), 300: tint(color, 44) }[n] ?? null;
  return null;
}

const DECL = {
  bg: (v) => `background-color: ${v};`,
  text: (v) => `color: ${v};`,
  border: (v) => `border-color: ${v};`,
  divide: (v) => `border-color: ${v};`,
  ring: (v) => `--tw-ring-color: ${v};`,
  from: (v) => `--tw-gradient-from: ${v};`,
  via: (v) => `--tw-gradient-via: ${v};`,
  to: (v) => `--tw-gradient-to: ${v};`,
};

const escapeClass = (cls) => cls.replace(/([:/.[\]])/g, '\\$1');

function* files(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* files(path);
    else if (/\.(tsx?|jsx?)$/.test(name)) yield path;
  }
}

const COLORS = ['white', 'black', ...NEUTRAL, ...HUES].join('|');
const TOKEN = new RegExp(
  `(?<![\\w:/\\-\\[])((?:hover:|focus:)?)(bg|text|border|ring|divide|from|via|to)-(${COLORS})(?:-(50|100|200|300|400|500|600|700|800|900|950))?(?:/(\\d{1,3}))?(?![\\w\\-/\\[])`,
  'g',
);

const found = new Map();
for (const file of files(SRC)) {
  const text = readFileSync(file, 'utf8');
  for (const m of text.matchAll(TOKEN)) {
    const [token, state, prop, color, n, alpha] = m;
    if ((color === 'white' || color === 'black') !== (n === undefined)) continue;
    const value = darkValue(prop, color, n === undefined ? undefined : Number(n), alpha === undefined ? undefined : Number(alpha));
    if (value) found.set(token, { state, prop, value });
  }
}

const rules = [...found.entries()]
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([token, { state, prop, value }]) => {
    const pseudo = STATES[state];
    const own = `:not([class*="dark:${state}${prop}-"])`;
    const target = prop === 'divide' ? `.${escapeClass(token)}${own} > :not(:last-child)` : `.${escapeClass(token)}${pseudo}${own}`;
    return `.dark ${target} { ${DECL[prop](value)} }`;
  });

// ---------- Light mode for the dark-designed stage screens ----------
// Voice rooms, calls and Discover were designed on a dark stage and use white overlays (hover:bg-white/5,
// border-white/10) and pale text. Their palettes follow the theme (styles/stage-palette.css); these rules turn
// the overlays and pale text dark in the light theme. They only apply inside an element whose inline style
// uses a stage colour (var(--sx-...)), so the rest of the app is untouched.
const STAGE = ':root:not(.dark) [style*="--sx-"]';
const WHITE_ALPHA = /(?<![\w:/\-[])((?:hover:)?)(bg|border|divide)-white\/(\d{1,3}|\[0?\.\d+\])(?![\w\-/[])/g;
const PALE_TEXT = /(?<![\w:/\-[])text-(slate|gray|zinc)-(50|100|200|300)(?![\w\-/[])/g;
const stageFound = new Map();
for (const file of files(SRC)) {
  const text = readFileSync(file, 'utf8');
  if (!/--sx-|COLORS\.|THEME\./.test(text)) continue;
  for (const m of text.matchAll(WHITE_ALPHA)) {
    const [token, state, prop, raw] = m;
    const pct = raw.startsWith('[') ? Number(raw.slice(1, -1)) * 100 : Number(raw);
    const amount = Math.min(90, Math.round((prop === 'bg' ? pct : pct * 1.5) * 10) / 10);
    const value = `color-mix(in oklab, #0f172a ${amount}%, transparent)`;
    const pseudo = STATES[state];
    const target = prop === 'divide' ? `.${escapeClass(token)} > :not(:last-child)` : `.${escapeClass(token)}${pseudo}`;
    stageFound.set(token, `${STAGE} ${target} { ${prop === 'bg' ? 'background-color' : 'border-color'}: ${value}; }`);
  }
  for (const m of text.matchAll(PALE_TEXT)) {
    const [token, , n] = m;
    const dark = { 50: 800, 100: 700, 200: 600, 300: 500 }[n];
    stageFound.set(token, `${STAGE} .${escapeClass(token)}:not([class*="dark:text-"]) { color: var(--color-slate-${dark}); }`);
  }
}
const stageRules = [...stageFound.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, rule]) => rule);

const header = `/*
 * GENERATED by scripts/gen-dark-fallback.mjs. Do not edit by hand; run \`pnpm --filter web theme:fallback\`.
 *
 * Dark versions of the light-only colour classes the app uses. Each rule only applies in the dark and navy
 * themes, and only to elements without their own dark: style for that property.
 */
`;

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `${header}\n${rules.join('\n')}\n\n/* Light theme on the dark-designed stage screens */\n${stageRules.join('\n')}\n`);
console.log(`dark-fallback.css: ${rules.length} dark rules, ${stageRules.length} stage rules`);
