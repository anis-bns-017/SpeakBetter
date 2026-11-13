// apps/web/src/test/setup.ts
// Runs before every test file: adds the DOM matchers (toBeInTheDocument…) and clears the page between tests.
import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
  try {
    sessionStorage.clear();
    localStorage.clear();
  } catch {
    /* storage not available */
  }
});
