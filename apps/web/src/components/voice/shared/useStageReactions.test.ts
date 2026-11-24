import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useStageReactions } from "./useStageReactions";

vi.mock("sonner", () => ({ toast: { warning: vi.fn(), error: vi.fn(), info: vi.fn(), success: vi.fn() } }));

type Handler = (data: unknown) => void;

function fakeSocket() {
  const handlers = new Map<string, Handler>();
  return {
    socket: {
      on: (event: string, fn: Handler) => void handlers.set(event, fn),
      off: (event: string) => void handlers.delete(event),
    } as never,
    emit: (event: string, data: unknown) => handlers.get(event)?.(data),
  };
}

describe("useStageReactions", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const setup = () => {
    const { socket, emit } = fakeSocket();
    const send = vi.fn();
    const hook = renderHook(() => useStageReactions({ socket, userId: "me", userName: "Me", sendStageReaction: send }));
    return { hook, send, emit };
  };

  it("shows one reaction for one tap and tells the room once", () => {
    const { hook, send } = setup();
    act(() => hook.result.current.react("❤️"));
    expect(hook.result.current.reactions).toHaveLength(1);
    expect(hook.result.current.reactions[0].emoji).toBe("❤️");
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith("❤️");
  });

  it("drops the server's echo of my own reaction, so it never shows twice", () => {
    const { hook, emit } = setup();
    act(() => hook.result.current.react("🔥"));
    act(() => emit("voice:stage-reaction", { id: "srv-1", userId: "me", emoji: "🔥" }));
    expect(hook.result.current.reactions).toHaveLength(1);
  });

  it("shows other people's reactions, with their name", () => {
    const { hook, emit } = setup();
    act(() => emit("voice:stage-reaction", { id: "srv-2", userId: "other", userName: "Lena", emoji: "🎉" }));
    expect(hook.result.current.reactions).toHaveLength(1);
    expect(hook.result.current.reactions[0]).toMatchObject({ emoji: "🎉", userName: "Lena", local: false });
  });

  it("makes a clap a staggered burst that fans out, with one message to the room", () => {
    const { hook, send } = setup();
    act(() => hook.result.current.clap());
    const burst = hook.result.current.reactions;
    expect(burst.length).toBeGreaterThanOrEqual(3);
    expect(new Set(burst.map((r) => r.emoji))).toEqual(new Set(["👏"]));
    expect(burst.map((r) => r.delay)).toEqual([...burst.map((r) => r.delay)].sort((a, b) => (a ?? 0) - (b ?? 0)));
    expect(new Set(burst.map((r) => r.fan)).size).toBe(burst.length);
    expect(burst.filter((r) => r.ring)).toHaveLength(1);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("makes the burst bigger the longer you keep clapping", () => {
    const { hook } = setup();
    act(() => hook.result.current.clap());
    const first = hook.result.current.reactions.length;
    for (let i = 0; i < 8; i++) act(() => hook.result.current.clap());
    const total = hook.result.current.reactions.length;
    expect(total).toBeGreaterThan(first * 2);
  });

  it("makes someone else's clap a small burst too", () => {
    const { hook, emit } = setup();
    act(() => emit("voice:stage-reaction", { id: "srv-3", userId: "other", userName: "Jon", emoji: "👏" }));
    expect(hook.result.current.reactions.length).toBeGreaterThanOrEqual(3);
  });

  it("stops one finger flooding the room with the same emoji", () => {
    const { hook, send } = setup();
    for (let i = 0; i < 12; i++) act(() => hook.result.current.react("😂"));
    expect(send.mock.calls.length).toBeLessThan(12);
    expect(send.mock.calls.length).toBeGreaterThan(0);
  });

  it("removes reactions once their animation is over", () => {
    const { hook } = setup();
    act(() => hook.result.current.react("💯"));
    expect(hook.result.current.reactions).toHaveLength(1);
    act(() => {
      vi.advanceTimersByTime(6000);
    });
    expect(hook.result.current.reactions).toHaveLength(0);
  });

  it("celebrates every tenth reaction of mine with confetti", () => {
    const { hook } = setup();
    for (let i = 0; i < 10; i++) {
      act(() => hook.result.current.react(["❤️", "🔥", "🎉", "😮", "🙌"][i % 5]));
    }
    expect(hook.result.current.milestones).toHaveLength(1);
    expect(hook.result.current.milestones[0].count).toBe(10);
  });
});
