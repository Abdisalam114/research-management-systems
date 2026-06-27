import axios from "axios";
import { API_BASE } from "../config/apiBase";
import { PROGRAM_TIER_HEADER, PROGRAM_TIER_STORAGE_KEY } from "../constants/programTier";

export const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const tier = localStorage.getItem(PROGRAM_TIER_STORAGE_KEY);
  if (tier) {
    config.headers = config.headers || {};
    config.headers[PROGRAM_TIER_HEADER] = tier;
  }
  return config;
});
