import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { programTierLabel } from "../constants/programTier";
import {
  clearProgramTier,
  getProgramTier,
  migrateProgramTierFromLegacy,
  setProgramTier as persistProgramTier,
} from "../utils/programTierStorage";

const ProgramTierContext = createContext(null);

migrateProgramTierFromLegacy();

export function ProgramTierProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [programTier, setProgramTierState] = useState(() => getProgramTier());

  const clearTier = useCallback(() => {
    setProgramTierState(null);
    clearProgramTier();
  }, []);

  const selectProgramTier = useCallback((tier) => {
    setProgramTierState(tier);
    persistProgramTier(tier);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      clearTier();
    }
  }, [isAuthenticated, clearTier]);

  const value = useMemo(
    () => ({
      programTier,
      programTierLabel: programTierLabel(programTier),
      selectProgramTier,
      clearProgramTier: clearTier,
      hasProgramTier: Boolean(programTier),
    }),
    [programTier, selectProgramTier, clearTier]
  );

  return <ProgramTierContext.Provider value={value}>{children}</ProgramTierContext.Provider>;
}

export function useProgramTier() {
  const ctx = useContext(ProgramTierContext);
  if (!ctx) throw new Error("useProgramTier must be used within ProgramTierProvider");
  return ctx;
}
