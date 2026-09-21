import { readFileSync } from "node:fs"
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

const { version: appVersion } = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf-8"))

// Pakete für manualChunks (siehe build.rollupOptions unten).
const REACT_CORE = new Set(["react", "react-dom", "scheduler"]);
const VENDOR_EAGER = new Set([
  "react-router", "react-router-dom", "@tanstack/react-query", "@tanstack/query-core",
  "zustand", "zod", "framer-motion", "lucide-react", "@supabase/supabase-js",
  "@supabase/auth-js", "@supabase/postgrest-js", "@supabase/realtime-js",
  "@supabase/storage-js", "@supabase/functions-js", "@supabase/node-fetch",
]);
// react-markdown zieht das komplette unified/remark/micromark-Ökosystem nach sich.
const MARKDOWN_PKG = /^(react-markdown|remark-.*|rehype-.*|unified|micromark.*|mdast-.*|hast-.*|unist-.*|vfile.*|devlop|bail|trough|is-plain-obj|property-information|space-separated-tokens|comma-separated-tokens|decode-named-character-reference|character-entities.*|ccount|escape-string-regexp|markdown-table|longest-streak|zwitch|trim-lines|html-url-attributes|style-to-.*|inline-style-parser)$/;

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  test: {
    environment: "jsdom",
    globals: true,
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    exclude: ["src/__integration__/**"],
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
    allowedHosts: ["kart.cheezuscraizt.de", "host.docker.internal", "kartslalom-dev"]
  },
  build: {
    sourcemap: false,
    modulePreload: { polyfill: false },
    rollupOptions: {
      output: {
        // Fremdcode, der beim Start geladen wird, in zwei stabile Chunks gruppieren: der
        // App-Chunk ("index") ändert sich dann pro Release, diese beiden bleiben im
        // Browser-Cache. Der frühere Substring-Match id.includes("react") tat das nur
        // zufällig (und machte den vendor-Zweig für lucide-react unerreichbar).
        // Bewusst eine explizite Positivliste: die Export-Bibliotheken (jspdf, html2canvas,
        // svg2pdf.js, dompurify, canvg) werden per dynamic import nachgeladen und dürfen
        // nicht in einen eager Chunk gezogen werden; neue, hier nicht gelistete Pakete
        // landen neutral im App-Chunk. [^\\/]* nach node_modules deckt auch den
        // iCloud-Workaround-Pfad node_modules.nosync ab.
        manualChunks: (id) => {
          const pkg = /[\\/]node_modules[^\\/]*[\\/](@[^\\/]+[\\/][^\\/]+|[^\\/]+)[\\/]/.exec(id)?.[1];
          if (!pkg) return;
          if (REACT_CORE.has(pkg)) return "react";
          if (VENDOR_EAGER.has(pkg) || MARKDOWN_PKG.test(pkg)) return "vendor";
        },
      },
    },
  },
})
