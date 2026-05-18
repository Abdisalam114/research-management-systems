import axios from "axios";
import { API_BASE } from "../config/apiBase";

export const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
});
