import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { fakeUseT } from "../test/fakeI18n";

const put = vi.fn();
const refreshUser = vi.fn();
const user = {
  id: "u1",
  email: "rina@example.com",
  name: "Rina Akter",
  profile: { nativeLanguage: "bn", learningLanguages: ["en"], xp: 0, streak: 0, onboardedAt: null },
};

vi.mock("../lib/api/client", () => ({ apiClient: { put: (...args: unknown[]) => put(...args) } }));
vi.mock("../contexts/useAuth", () => ({ useAuth: () => ({ user, refreshUser }) }));
vi.mock("../i18n", () => ({ useT: fakeUseT }));
vi.mock("../hooks/useDiscovery", () => ({ useTrendingRooms: () => ({ data: [] }) }));
vi.mock("../components/dashboard/EchoMascot", () => ({ EchoMascot: () => null }));
vi.mock("framer-motion", async (importOriginal) => ({
  ...(await importOriginal<typeof import("framer-motion")>()),
  useReducedMotion: () => true,
}));

import { WelcomePage } from "./WelcomePage";

const renderGuide = () =>
  render(
    <MemoryRouter initialEntries={["/welcome"]}>
      <Routes>
        <Route path="/welcome" element={<WelcomePage />} />
        <Route path="/placement" element={<p>Level test page</p>} />
        <Route path="/dashboard" element={<p>Dashboard page</p>} />
      </Routes>
    </MemoryRouter>,
  );

describe("first-day guide", () => {
  beforeEach(() => {
    put.mockReset().mockResolvedValue({ data: { success: true } });
    refreshUser.mockReset().mockResolvedValue(null);
  });

  it("starts from the home language chosen at sign-up", () => {
    renderGuide();
    expect(screen.getByRole("heading", { name: "Which language do you speak at home?" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /বাংলা\s*Bangla/ })).toHaveAttribute("aria-pressed", "true");
  });

  it("saves every answer when the guide is finished", async () => {
    const ui = userEvent.setup();
    renderGuide();

    await ui.click(screen.getByRole("button", { name: /Continue/ }));
    await ui.click(await screen.findByRole("button", { name: /Speak with confidence/ }));
    await ui.click(screen.getByRole("button", { name: /Pass an exam/ }));
    await ui.click(screen.getByRole("button", { name: /Continue/ }));
    await ui.click(await screen.findByRole("button", { name: /I know the basics/ }));
    await ui.click(screen.getByRole("button", { name: /Continue/ }));
    await ui.click(await screen.findByRole("button", { name: /Serious/ }));
    await ui.click(screen.getByRole("button", { name: /Finish/ }));

    await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
    expect(put).toHaveBeenCalledWith("/profile/me/onboarding", {
      nativeLanguage: "bn",
      goals: ["speaking", "exam"],
      selfLevel: "basic",
      dailyGoalMinutes: 20,
      interfaceLanguage: "en",
    });
    expect(await screen.findByText("Let's say your first sentence.")).toBeInTheDocument();
    expect(refreshUser).toHaveBeenCalled();
  });

  it("goes to the level test and remembers where it was", async () => {
    const ui = userEvent.setup();
    renderGuide();
    await ui.click(screen.getByRole("button", { name: /Continue/ }));
    await ui.click(await screen.findByRole("button", { name: /Continue/ }));
    await ui.click(await screen.findByRole("button", { name: /Take the 8-minute level test/ }));

    expect(await screen.findByText("Level test page")).toBeInTheDocument();
    expect(JSON.parse(sessionStorage.getItem("sb.welcome") ?? "{}")).toMatchObject({ step: 2, nativeLanguage: "bn" });
  });

  it("skipping saves what was answered and opens the dashboard", async () => {
    const ui = userEvent.setup();
    renderGuide();
    await ui.click(screen.getByRole("button", { name: "Skip for now" }));

    await waitFor(() => expect(put).toHaveBeenCalledWith("/profile/me/onboarding", { nativeLanguage: "bn", interfaceLanguage: "en" }));
    expect(await screen.findByText("Dashboard page")).toBeInTheDocument();
  });

  it("stays on the page and says so when saving fails", async () => {
    put.mockRejectedValueOnce(new Error("Network Error"));
    const ui = userEvent.setup();
    renderGuide();
    await ui.click(screen.getByRole("button", { name: "Skip for now" }));

    await waitFor(() => expect(put).toHaveBeenCalled());
    expect(screen.queryByText("Dashboard page")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Which language do you speak at home?" })).toBeInTheDocument();
  });
});
