import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    hmr: {
      // Prevent full page reload when switching browser tabs
      // Vite loses WebSocket connection on backgrounded tabs and reloads on reconnect
      overlay: false,
      timeout: 60000,
    },
  },
});
