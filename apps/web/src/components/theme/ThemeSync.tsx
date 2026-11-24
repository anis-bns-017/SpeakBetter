import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../../lib/api/client";
import { useAuth } from "../../contexts/useAuth";
import { useTheme } from "../../contexts/ThemeContext";
import { fromServerTheme } from "../../lib/theme";
import { setSoundEnabled } from "../../lib/sfx";
import { setAutoTranslate } from "../../lib/autoTranslate";
import type { Settings } from "../../hooks/useSettings";

/**
 * Brings the theme saved on the account to a device where nothing was picked yet, so a theme chosen on
 * the laptop shows up on the phone too. A choice made on this device always wins.
 */
export const ThemeSync = () => {
  const { user } = useAuth();
  const { chosenHere, setTheme } = useTheme();
  const adopted = useRef(false);
  const { data } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => (await apiClient.get<Settings>("/settings")).data,
    enabled: !!user,
    staleTime: 5 * 60_000,
    retry: 1,
  });

  useEffect(() => {
    if (adopted.current || chosenHere || !data) return;
    adopted.current = true;
    const saved = fromServerTheme(data.theme);
    if (saved && saved !== "system") setTheme(saved);
  }, [data, chosenHere, setTheme]);

  // Sound effects and auto-translate follow the account's settings as soon as they load or change
  useEffect(() => {
    if (!data) return;
    setSoundEnabled(data.soundEffects !== false);
    setAutoTranslate(data.autoTranslateMessages === true);
  }, [data]);

  return null;
};
