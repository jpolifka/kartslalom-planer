import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    setupFiles: ["src/test-setup.ts"],
  },
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    allowedHosts: ["kart.cheezuscraizt.de"]
  },
  build: {
    sourcemap: false,
    modulePreload: { polyfill: false },
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes("react") || id.includes("react-dom")) return "react";
          if (id.includes("framer-motion") || id.includes("lucide-react")) return "vendor";
        },
      },
    },
  },
})
