import { describe, expect, it } from "vitest";
import { deviceName, isMobileAgent } from "./device";

const CHROME_WINDOWS =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
const EDGE_WINDOWS = `${CHROME_WINDOWS} Edg/130.0`;
const SAFARI_IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const CHROME_ANDROID =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36";

describe("deviceName", () => {
  it("names the browser and the system", () => {
    expect(deviceName(CHROME_WINDOWS)).toBe("Chrome on Windows");
    expect(deviceName(EDGE_WINDOWS)).toBe("Edge on Windows");
    expect(deviceName(SAFARI_IPHONE)).toBe("Safari on iOS");
    expect(deviceName(CHROME_ANDROID)).toBe("Chrome on Android");
  });

  it("copes with a missing user agent", () => {
    expect(deviceName(null)).toBe("Unknown device");
    expect(deviceName("curl/8.0")).toBe("Browser");
  });
});

describe("isMobileAgent", () => {
  it("tells phones from computers", () => {
    expect(isMobileAgent(SAFARI_IPHONE)).toBe(true);
    expect(isMobileAgent(CHROME_ANDROID)).toBe(true);
    expect(isMobileAgent(CHROME_WINDOWS)).toBe(false);
    expect(isMobileAgent(undefined)).toBe(false);
  });
});
