// src/contexts/SidebarContext.tsx
// Single source of truth for the app navigation: desktop collapse state (remembered),
// the ⌘K command palette and the mobile "More" sheet.
import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

const STORAGE_KEY = 'speakbetter-sidebar-collapsed';

const readCollapsed = (): boolean => {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
};

interface SidebarContextType {
  isMinimized: boolean;
  toggleSidebar: () => void;
  setSidebarMinimized: (minimized: boolean) => void;
  isPaletteOpen: boolean;
  openPalette: () => void;
  closePalette: () => void;
  togglePalette: () => void;
  isMobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export const SidebarProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isMinimized, setIsMinimized] = useState(readCollapsed);
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [isMobileMenuOpen, setMobileMenuOpen] = useState(false);

  const setSidebarMinimized = useCallback((minimized: boolean) => {
    setIsMinimized(minimized);
    try {
      window.localStorage.setItem(STORAGE_KEY, String(minimized));
    } catch {
      /* storage unavailable */
    }
  }, []);

  const toggleSidebar = useCallback(() => {
    setIsMinimized((prev) => {
      try {
        window.localStorage.setItem(STORAGE_KEY, String(!prev));
      } catch {
        /* storage unavailable */
      }
      return !prev;
    });
  }, []);

  const openPalette = useCallback(() => setIsPaletteOpen(true), []);
  const closePalette = useCallback(() => setIsPaletteOpen(false), []);
  const togglePalette = useCallback(() => setIsPaletteOpen((v) => !v), []);

  const value = useMemo(
    () => ({
      isMinimized,
      toggleSidebar,
      setSidebarMinimized,
      isPaletteOpen,
      openPalette,
      closePalette,
      togglePalette,
      isMobileMenuOpen,
      setMobileMenuOpen,
    }),
    [isMinimized, toggleSidebar, setSidebarMinimized, isPaletteOpen, openPalette, closePalette, togglePalette, isMobileMenuOpen],
  );

  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components -- hook lives with its provider
export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }
  return context;
};
