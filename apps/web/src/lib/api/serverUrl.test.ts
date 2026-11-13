// @vitest-environment-options {"url": "http://192.168.1.20:15173/dashboard"}
import { describe, expect, it } from "vitest";
import { serverUrl } from "./serverUrl";

// The page here is opened from another device on the Wi-Fi (or the phone app)
describe("serverUrl on another device, in development", () => {
  it("points localhost at the computer that served the page", () => {
    expect(serverUrl("http://localhost:3001", "x")).toBe("http://192.168.1.20:3001");
    expect(serverUrl("http://localhost:3001/voice", "x")).toBe("http://192.168.1.20:3001/voice");
    expect(serverUrl("ws://127.0.0.1:18080", "x")).toBe("ws://192.168.1.20:18080");
  });

  it("leaves real addresses alone and uses the fallback when nothing is set", () => {
    expect(serverUrl("https://api.speakbetter.example/", "x")).toBe("https://api.speakbetter.example");
    expect(serverUrl(undefined, "http://localhost:3000")).toBe("http://192.168.1.20:3000");
  });
});
