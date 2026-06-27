import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import {
  PROGRAM_TIER_STORAGE_KEY,
  programTierLabel,
} from "../constants/programTier";

const ProgramTierContext = createContext(null);

export function ProgramTierProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [programTier, setProgramTier] = useState(() => localStorage.getItem(PROGRAM_TIER_STORAGE_KEY));

  const clearProgramTier = useCallback(() => {
    setProgramTier(null);
    localStorage.removeItem(PROGRAM_TIER_STORAGE_KEY);
  }, []);

  const selectProgramTier = useCallback((tier) => {
    setProgramTier(tier);
    localStorage.setItem(PROGRAM_TIER_STORAGE_KEY, tier);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      clearProgramTier();
    }
  }, [isAuthenticated, clearProgramTier]);

  const value = useMemo(
    () => ({
      programTier,
      programTierLabel: programTierLabel(programTier),
      selectProgramTier,
      clearProgramTier,
      hasProgramTier: Boolean(programTier),
    }),
    [programTier, selectProgramTier, clearProgramTier]
  );

  return <ProgramTierContext.Provider value={value}>{children}</ProgramTierContext.Provider>;
}

export function useProgramTier() {
  const ctx = useContext(ProgramTierContext);
  if (!ctx) throw new Error("useProgramTier must be used within ProgramTierProvider");
  return ctx;
}
