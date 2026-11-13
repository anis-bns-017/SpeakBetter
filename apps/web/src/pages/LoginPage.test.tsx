import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { fakeUseT } from "../test/fakeI18n";

const login = vi.fn();
const toastError = vi.fn();

vi.mock("../contexts/useAuth", () => ({ useAuth: () => ({ login }) }));
vi.mock("../i18n", () => ({ useT: fakeUseT }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: (...args: unknown[]) => toastError(...args) } }));

import { LoginPage } from "./LoginPage";

const renderLogin = () =>
  render(
    <MemoryRouter initialEntries={["/login"]}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<p>Home page</p>} />
      </Routes>
    </MemoryRouter>,
  );

describe("sign in", () => {
  beforeEach(() => {
    login.mockReset();
    toastError.mockReset();
  });

  it("signs in with the typed email and password, then opens the app", async () => {
    login.mockResolvedValue(undefined);
    const ui = userEvent.setup();
    renderLogin();

    await ui.type(screen.getByPlaceholderText("you@example.com"), "rina@example.com");
    await ui.type(screen.getByPlaceholderText("Your password"), "secret-123");
    await ui.click(screen.getByRole("button", { name: /Sign in/ }));

    await waitFor(() => expect(login).toHaveBeenCalledWith("rina@example.com", "secret-123"));
    expect(await screen.findByText("Home page")).toBeInTheDocument();
  });

  it("shows the server's reason when signing in fails", async () => {
    login.mockRejectedValue({ response: { status: 401, data: { message: "That password is not right" } } });
    const ui = userEvent.setup();
    renderLogin();

    await ui.type(screen.getByPlaceholderText("you@example.com"), "rina@example.com");
    await ui.type(screen.getByPlaceholderText("Your password"), "wrong");
    await ui.click(screen.getByRole("button", { name: /Sign in/ }));

    await waitFor(() => expect(toastError).toHaveBeenCalledWith("That password is not right"));
    expect(screen.queryByText("Home page")).not.toBeInTheDocument();
  });

  it("does not claim made-up numbers", () => {
    renderLogin();
    expect(screen.queryByText(/50K\+/)).not.toBeInTheDocument();
    expect(screen.queryByText(/4\.9/)).not.toBeInTheDocument();
  });
});
