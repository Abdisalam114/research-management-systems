import axios from "axios";
import { API_BASE } from "../config/apiBase";
import { PROGRAM_TIER_HEADER } from "../constants/programTier";
import { getProgramTier } from "../utils/programTierStorage";

export const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const tier = getProgramTier();
  if (tier) {
    config.headers = config.headers || {};
    config.headers[PROGRAM_TIER_HEADER] = tier;
  }
  return config;
});
