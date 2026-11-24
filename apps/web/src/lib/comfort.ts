/**
 * Reading comfort: bigger text and calmer motion. Kept on this device (localStorage) and applied before the
 * first paint, so a large-text setting never flashes small first. Everything in the app is sized in rem,
 * so changing the root font size scales the whole interface.
 */

export type TextSize = "normal" | "large" | "xlarge";

export const TEXT_SIZES: TextSize[] = ["normal", "large", "xlarge"];
export const TEXT_SIZE_PERCENT: Record<TextSize, number> = { normal: 100, large: 112.5, xlarge: 125 };

const SIZE_KEY = "sb.textSize";
const MOTION_KEY = "sb.reduceMotion";

export const isTextSize = (value: unknown): value is TextSize => typeof value === "string" && (TEXT_SIZES as string[]).includes(value);

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // storage blocked: the setting still applies until the page closes
  }
}

export const readTextSize = (): TextSize => {
  const v = read(SIZE_KEY);
  return isTextSize(v) ? v : "normal";
};

export const readReduceMotion = (): boolean => read(MOTION_KEY) === "1";

export function applyComfort(size: TextSize, reduceMotion: boolean, root: HTMLElement = document.documentElement) {
  root.style.fontSize = size === "normal" ? "" : `${TEXT_SIZE_PERCENT[size]}%`;
  if (reduceMotion) root.setAttribute("data-reduce-motion", "true");
  else root.removeAttribute("data-reduce-motion");
}

export function setTextSize(size: TextSize) {
  write(SIZE_KEY, size);
  applyComfort(size, readReduceMotion());
}

export function setReduceMotion(on: boolean) {
  write(MOTION_KEY, on ? "1" : "0");
  applyComfort(readTextSize(), on);
}

/** Call once at start-up */
export function initComfort() {
  if (typeof document === "undefined") return;
  applyComfort(readTextSize(), readReduceMotion());
}
