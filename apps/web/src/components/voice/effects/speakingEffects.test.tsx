import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SpeakingEffect } from "./SpeakingEffect";
import { SPEAKING_EFFECTS, SPEAKING_EFFECT_IDS, readSpeakingEffect } from "./speakingEffects";

describe("speaking effects", () => {
  it("describes every effect once: the classic glow and 20 more", () => {
    expect(SPEAKING_EFFECT_IDS).toHaveLength(21);
    expect(SPEAKING_EFFECTS.map((e) => e.id)).toEqual([...SPEAKING_EFFECT_IDS]);
  });

  it("treats a missing or unknown effect as the classic glow", () => {
    expect(readSpeakingEffect(null)).toBe("classic");
    expect(readSpeakingEffect("unicorn")).toBe("classic");
    expect(readSpeakingEffect("mughal")).toBe("mughal");
  });

  it.each(SPEAKING_EFFECT_IDS)("draws %s", (effect) => {
    const back = render(<SpeakingEffect effect={effect} layer="back" size={76} level={0.6} />);
    const front = render(<SpeakingEffect effect={effect} layer="front" size={76} level={0.6} />);
    // Every effect draws something on at least one side of the avatar
    expect(back.container.childElementCount + front.container.childElementCount).toBeGreaterThan(0);
  });
});
