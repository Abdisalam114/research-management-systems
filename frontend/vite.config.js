import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const API_TARGET = "http://127.0.0.1:5000";

const apiProxy = {
  target: API_TARGET,
  changeOrigin: true,
  secure: false,
  configure(proxy) {
    proxy.on("proxyReq", (proxyReq, req) => {
      if (req.headers.host) {
        proxyReq.setHeader("X-Forwarded-Host", req.headers.host);
        proxyReq.setHeader("X-Forwarded-Proto", req.headers["x-forwarded-proto"] || "http");
      }
    });
  },
};

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": apiProxy,
      "/uploads": { target: API_TARGET, changeOrigin: true, secure: false },
    },
  },
  preview: {
    proxy: {
      "/api": apiProxy,
      "/uploads": { target: API_TARGET, changeOrigin: true, secure: false },
    },
  },
});
