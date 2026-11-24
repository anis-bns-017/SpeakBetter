import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const get = vi.fn();
vi.mock("./api/client", () => ({ apiClient: { get: (...args: unknown[]) => get(...args) } }));

const load = async () => {
  vi.resetModules();
  return import("./autoTranslate");
};

beforeEach(() => {
  get.mockReset();
  localStorage.clear();
});
afterEach(() => localStorage.clear());

describe("auto-translate", () => {
  it("does nothing while the setting is off", async () => {
    const { translateForChat } = await load();
    await expect(translateForChat("Good morning")).resolves.toBeNull();
    expect(get).not.toHaveBeenCalled();
  });

  it("translates a message once and remembers it", async () => {
    get.mockResolvedValue({ data: { translation: "সুপ্রভাত", notice: null } });
    const { setAutoTranslate, translateForChat, cachedTranslation } = await load();
    setAutoTranslate(true);
    await expect(translateForChat("Good morning")).resolves.toBe("সুপ্রভাত");
    await expect(translateForChat("Good morning")).resolves.toBe("সুপ্রভাত");
    expect(get).toHaveBeenCalledTimes(1);
    expect(cachedTranslation("Good morning")).toBe("সুপ্রভাত");
  });

  it("sends one request at a time", async () => {
    let running = 0;
    let most = 0;
    get.mockImplementation(async () => {
      running++;
      most = Math.max(most, running);
      await Promise.resolve();
      running--;
      return { data: { translation: "x", notice: null } };
    });
    const { setAutoTranslate, translateForChat } = await load();
    setAutoTranslate(true);
    await Promise.all(["one two", "three four", "five six"].map(translateForChat));
    expect(get).toHaveBeenCalledTimes(3);
    expect(most).toBe(1);
  });

  it("skips links, emoji-only and very long messages", async () => {
    const { setAutoTranslate, translateForChat } = await load();
    setAutoTranslate(true);
    await translateForChat("see https://example.com");
    await translateForChat("🎉🎉");
    await translateForChat("a".repeat(201));
    expect(get).not.toHaveBeenCalled();
  });

  it("stops asking when the free allowance runs out", async () => {
    get.mockResolvedValue({ data: { translation: null, notice: "limit" } });
    const { setAutoTranslate, translateForChat } = await load();
    setAutoTranslate(true);
    await translateForChat("first message");
    await translateForChat("second message");
    expect(get).toHaveBeenCalledTimes(1);
  });

  it("does not translate when the learner chose English only", async () => {
    localStorage.setItem("sb.lookup.lang", "en");
    const { setAutoTranslate, translateForChat } = await load();
    setAutoTranslate(true);
    await expect(translateForChat("Hello there")).resolves.toBeNull();
    expect(get).not.toHaveBeenCalled();
  });

  it("survives a failed request", async () => {
    get.mockRejectedValueOnce(new Error("down")).mockResolvedValue({ data: { translation: "y", notice: null } });
    const { setAutoTranslate, translateForChat } = await load();
    setAutoTranslate(true);
    await expect(translateForChat("first one")).resolves.toBeNull();
    await expect(translateForChat("second one")).resolves.toBe("y");
  });
});
