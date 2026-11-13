import { describe, expect, it } from "vitest";
import { apiErrorMessage, apiErrorStatus, asApiError } from "./errors";

describe("apiErrorMessage", () => {
  it("uses the server's message", () => {
    const error = { response: { status: 400, data: { message: "Email already in use" } } };
    expect(apiErrorMessage(error, "Something went wrong")).toBe("Email already in use");
  });

  it("uses the first message when the server sends a list", () => {
    const error = { response: { data: { message: ["name should not be empty", "email must be an email"] } } };
    expect(apiErrorMessage(error, "x")).toBe("name should not be empty");
  });

  it("falls back when there is no answer from the server", () => {
    expect(apiErrorMessage(new Error("Network Error"), "We couldn't reach SpeakBetter")).toBe("We couldn't reach SpeakBetter");
    expect(apiErrorMessage(undefined, "fallback")).toBe("fallback");
    expect(apiErrorMessage("boom", "fallback")).toBe("fallback");
  });
});

describe("apiErrorStatus and asApiError", () => {
  it("reads the status without throwing on odd values", () => {
    expect(apiErrorStatus({ response: { status: 429 } })).toBe(429);
    expect(apiErrorStatus(null)).toBeUndefined();
    expect(asApiError(42)).toEqual({});
  });
});
