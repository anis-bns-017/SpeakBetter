import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../lib/api/client";
import { useAuth } from "../contexts/useAuth";
import { useTheme } from "../contexts/ThemeContext";
import type { ThemePreference } from "../lib/theme";
import type { Settings } from "./useSettings";

/** Picks a theme now and saves it to the account in the background */
export function useChooseTheme() {
  const { setTheme } = useTheme();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const save = useMutation({
    mutationFn: async (theme: ThemePreference) => (await apiClient.put<Settings>("/settings", { theme: theme.toUpperCase() })).data,
    onSuccess: (settings) => queryClient.setQueryData(["settings"], settings),
  });
  return (theme: ThemePreference) => {
    setTheme(theme);
    if (user) save.mutate(theme);
  };
}
