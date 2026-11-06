/**
 * The app's colour themes. The choice lives in localStorage (so it applies before React loads, with no
 * white flash) and in the account settings (so it follows you to other devices).
 *
 * - light: the bright default
 * - dark:  charcoal night mode
 * - navy:  a deep navy-blue night mode (dark mode with a blue palette)
 * - system: light or dark, following the device
 *
 * index.html runs a copy of `applyTheme` inline before the first paint; keep the two in step.
 */

export type ThemePreference = 'light' | 'dark' | 'navy' | 'system';
export type ResolvedTheme = 'light' | 'dark' | 'navy';

export const THEME_STORAGE_KEY = 'speakbetter-theme';
export const THEME_PREFERENCES: ThemePreference[] = ['light', 'dark', 'navy', 'system'];

/** Browser bar colour on phones and in the installed app */
const BAR_COLOR: Record<ResolvedTheme, string> = {
  light: '#4f46e5',
  dark: '#0b0b14',
  navy: '#0b1631',
};

export const isThemePreference = (value: unknown): value is ThemePreference =>
  typeof value === 'string' && (THEME_PREFERENCES as string[]).includes(value);

/** The account setting comes back as SYSTEM / LIGHT / DARK / NAVY */
export const fromServerTheme = (value: unknown): ThemePreference | null => {
  const v = String(value ?? '').toLowerCase();
  return isThemePreference(v) ? v : null;
};

export const prefersDark = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-color-scheme: dark)').matches;

export const resolveTheme = (preference: ThemePreference): ResolvedTheme =>
  preference === 'system' ? (prefersDark() ? 'dark' : 'light') : preference;

export function readStoredTheme(): ThemePreference | null {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(value) ? value : null;
  } catch {
    return null;
  }
}

export function storeTheme(preference: ThemePreference) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    /* private mode: the theme still applies for this visit */
  }
}

/** Puts the theme on <html>: the `dark` class drives every dark: style, data-theme picks the palette */
export function applyTheme(preference: ThemePreference): ResolvedTheme {
  const resolved = resolveTheme(preference);
  const root = document.documentElement;
  root.classList.toggle('dark', resolved !== 'light');
  root.dataset.theme = resolved;
  root.style.colorScheme = resolved === 'light' ? 'light' : 'dark';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', BAR_COLOR[resolved]);
  return resolved;
}
