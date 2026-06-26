import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    setupFiles: ["src/test-setup.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts", "src/**/*.tsx"],
      exclude: [
        // Test-Infrastruktur
        "src/**/*.test.ts",
        "src/**/*.test.tsx",
        "src/test-setup.ts",
        "src/main.tsx",
        "src/router.tsx",
        // Pages + Editor-UI: brauchen Router/Auth/QueryProvider → Playwright
        "src/pages/**",
        "src/store/**",
        "src/pages/editor/components/**",
        "src/pages/editor/hooks/**",
        "src/pages/editor/editorStyles.ts",
        "src/components/FormationThumbnail.tsx",
      ],
      thresholds: {
        statements: 80,
        branches: 70,
        functions: 80,
        lines: 80,
      },
      reporter: ["text", "html"],
    },
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
