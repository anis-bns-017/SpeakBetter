// src/contexts/SidebarContext.tsx
import React, { createContext, useContext, useState, ReactNode } from 'react';

interface SidebarContextType {
  isMinimized: boolean;
  toggleSidebar: () => void;
  setSidebarMinimized: (minimized: boolean) => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export const SidebarProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isMinimized, setIsMinimized] = useState(false);

  const toggleSidebar = () => setIsMinimized((prev) => !prev);
  const setSidebarMinimized = (minimized: boolean) => setIsMinimized(minimized);

  return (
    <SidebarContext.Provider value={{ isMinimized, toggleSidebar, setSidebarMinimized }}>
      {children}
    </SidebarContext.Provider>
  );
};

export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }
  return context;
};