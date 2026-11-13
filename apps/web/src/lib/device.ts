// apps/web/src/lib/device.ts

/** "Chrome on Windows" from a browser's user-agent text */
export function deviceName(agent: string | null | undefined): string {
  if (!agent) return "Unknown device";
  const browser = /Edg\//.test(agent)
    ? "Edge"
    : /OPR\/|Opera/.test(agent)
      ? "Opera"
      : /Chrome\//.test(agent)
        ? "Chrome"
        : /Firefox\//.test(agent)
          ? "Firefox"
          : /Safari\//.test(agent)
            ? "Safari"
            : "Browser";
  const os = /Android/.test(agent)
    ? "Android"
    : /iPhone|iPad/.test(agent)
      ? "iOS"
      : /Windows/.test(agent)
        ? "Windows"
        : /Mac OS/.test(agent)
          ? "macOS"
          : /Linux/.test(agent)
            ? "Linux"
            : "";
  return os ? `${browser} on ${os}` : browser;
}

/** Phones and tablets, for the icon */
export const isMobileAgent = (agent: string | null | undefined) => !!agent && /Android|iPhone|iPad|Mobile/.test(agent);
