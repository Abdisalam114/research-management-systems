import { PROGRAM_TIER_STORAGE_KEY } from "../constants/programTier";

const LEGACY_TIER_KEY = "just_rms_program_tier";

export function getProgramTier() {
  try {
    return sessionStorage.getItem(PROGRAM_TIER_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setProgramTier(tier) {
  try {
    if (tier) sessionStorage.setItem(PROGRAM_TIER_STORAGE_KEY, tier);
    else sessionStorage.removeItem(PROGRAM_TIER_STORAGE_KEY);
    localStorage.removeItem(LEGACY_TIER_KEY);
  } catch (_) {}
}

export function clearProgramTier() {
  setProgramTier(null);
}

export function migrateProgramTierFromLegacy() {
  try {
    if (!sessionStorage.getItem(PROGRAM_TIER_STORAGE_KEY)) {
      const legacy = localStorage.getItem(LEGACY_TIER_KEY);
      if (legacy) sessionStorage.setItem(PROGRAM_TIER_STORAGE_KEY, legacy);
    }
    localStorage.removeItem(LEGACY_TIER_KEY);
  } catch (_) {}
}
