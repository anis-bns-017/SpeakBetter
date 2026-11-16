import { afterEach, describe, expect, it, vi } from "vitest";
import { getMicrophone, isMicrophoneUnavailable, microphoneErrorMessage, microphoneSupport } from "./microphone";

const realMediaDevices = Object.getOwnPropertyDescriptor(navigator, "mediaDevices");

function setPage({ secure, mediaDevices }: { secure: boolean; mediaDevices: unknown }) {
  vi.stubGlobal("isSecureContext", secure);
  Object.defineProperty(navigator, "mediaDevices", { value: mediaDevices, configurable: true });
}

afterEach(() => {
  vi.unstubAllGlobals();
  if (realMediaDevices) Object.defineProperty(navigator, "mediaDevices", realMediaDevices);
  else Reflect.deleteProperty(navigator, "mediaDevices");
});

describe("microphone", () => {
  it("explains a plain-http page instead of crashing on undefined mediaDevices", async () => {
    setPage({ secure: false, mediaDevices: undefined });
    expect(microphoneSupport()).toBe("insecure");
    const error = await getMicrophone().catch((e: unknown) => e);
    expect(isMicrophoneUnavailable(error)).toBe(true);
    expect(microphoneErrorMessage(error)).toMatch(/https/);
  });

  it("calls getUserMedia when the page can use the microphone", async () => {
    const stream = {} as MediaStream;
    const getUserMedia = vi.fn().mockResolvedValue(stream);
    setPage({ secure: true, mediaDevices: { getUserMedia } });
    expect(microphoneSupport()).toBe("ok");
    await expect(getMicrophone({ echoCancellation: true })).resolves.toBe(stream);
    expect(getUserMedia).toHaveBeenCalledWith({ audio: { echoCancellation: true } });
  });

  it("names a missing microphone and a blocked one differently", () => {
    expect(microphoneErrorMessage({ name: "NotFoundError" })).toMatch(/No microphone found/);
    expect(microphoneErrorMessage({ name: "NotAllowedError" })).toMatch(/permissions/);
  });
});
