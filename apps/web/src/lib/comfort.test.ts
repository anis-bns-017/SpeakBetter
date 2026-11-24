import { afterEach, describe, expect, it } from "vitest";
import { applyComfort, initComfort, isTextSize, readReduceMotion, readTextSize, setReduceMotion, setTextSize } from "./comfort";

afterEach(() => {
  localStorage.clear();
  document.documentElement.style.fontSize = "";
  document.documentElement.removeAttribute("data-reduce-motion");
});

describe("comfort settings", () => {
  it("starts at normal size with motion on", () => {
    expect(readTextSize()).toBe("normal");
    expect(readReduceMotion()).toBe(false);
  });

  it("scales the root font size and remembers it", () => {
    setTextSize("large");
    expect(document.documentElement.style.fontSize).toBe("112.5%");
    expect(readTextSize()).toBe("large");
    setTextSize("xlarge");
    expect(document.documentElement.style.fontSize).toBe("125%");
    setTextSize("normal");
    expect(document.documentElement.style.fontSize).toBe("");
  });

  it("turns calmer motion on and off", () => {
    setReduceMotion(true);
    expect(document.documentElement.getAttribute("data-reduce-motion")).toBe("true");
    expect(readReduceMotion()).toBe(true);
    setReduceMotion(false);
    expect(document.documentElement.hasAttribute("data-reduce-motion")).toBe(false);
  });

  it("applies what was saved at start-up", () => {
    localStorage.setItem("sb.textSize", "xlarge");
    localStorage.setItem("sb.reduceMotion", "1");
    initComfort();
    expect(document.documentElement.style.fontSize).toBe("125%");
    expect(document.documentElement.getAttribute("data-reduce-motion")).toBe("true");
  });

  it("ignores a damaged saved value", () => {
    localStorage.setItem("sb.textSize", "gigantic");
    expect(readTextSize()).toBe("normal");
    expect(isTextSize("large")).toBe(true);
    expect(isTextSize("gigantic")).toBe(false);
  });

  it("applyComfort works on any element", () => {
    const el = document.createElement("div");
    applyComfort("large", true, el);
    expect(el.style.fontSize).toBe("112.5%");
    expect(el.getAttribute("data-reduce-motion")).toBe("true");
  });
});
