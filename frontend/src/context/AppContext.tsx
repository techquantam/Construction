"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/axios";

interface AppContextType {
  selectedSiteId: string;
  setSelectedSiteId: (id: string) => void;
  modifyQuery: string;
  setModifyQuery: (query: string) => void;
  activeMainMenu: number;
  setActiveMainMenu: (menu: number) => void;
  activeSubMenu: string | null;
  setActiveSubMenu: (subMenu: string | null) => void;
  sites: any[];
  isLoadingSites: boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppContextProvider({ children }: { children: React.ReactNode }) {
  const [selectedSiteId, setSelectedSiteId] = useState<string>("");
  const [modifyQuery, setModifyQuery] = useState<string>("");
  const [activeMainMenu, setActiveMainMenu] = useState<number>(0);
  const [activeSubMenu, setActiveSubMenu] = useState<string | null>(null);

  // Fetch sites globally so they are shared
  const { data: sitesData, isLoading: isLoadingSites } = useQuery({
    queryKey: ["sites"],
    queryFn: async () => {
      const response = await api.get("/sites");
      return response.data.data;
    },
  });

  const sites = sitesData || [];

  return (
    <AppContext.Provider
      value={{
        selectedSiteId,
        setSelectedSiteId,
        modifyQuery,
        setModifyQuery,
        activeMainMenu,
        setActiveMainMenu,
        activeSubMenu,
        setActiveSubMenu,
        sites,
        isLoadingSites,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error("useApp must be used within an AppContextProvider");
  }
  return context;
}
