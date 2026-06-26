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
        "src/vite-env.d.ts",
        "src/types.ts",
        // Pages + Editor-UI → Playwright
        "src/pages/**",
        "src/store/**",
        "src/components/auth/**",
        "src/components/layout/**",
        // Schwere Canvas/Map-Komponenten → Playwright
        "src/components/TrackCanvas.tsx",
        "src/components/MapSelector.tsx",
        "src/components/MapBackground.tsx",
        "src/components/AccentContent.tsx",
        "src/components/FormationThumbnail.tsx",
        "src/components/formation-editor/FormationEditorCanvas.tsx",
        // Auth-abhängige Hooks → Playwright
        "src/hooks/useProfile.ts",
        "src/hooks/useTracks.ts",
        // Supabase-Client-Init + Export-SVG → Integration
        "src/lib/supabase.ts",
        "src/lib/exportSVG.ts",
        "src/lib/geo.ts",
        "src/lib/areaSelection.ts",
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
