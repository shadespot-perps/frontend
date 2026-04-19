import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
    // cross-origin isolation — needed for SharedArrayBuffer (TFHE threading).
    // `credentialless` is used instead of `require-corp` so third-party
    // resources (fonts, iframes, etc.) are not blocked in strict browsers
    // like Brave that enforce COEP more aggressively than Chrome.
    headers: {
      'Cross-Origin-Opener-Policy':   'same-origin',
      'Cross-Origin-Embedder-Policy': 'credentialless',
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
  optimizeDeps: {
    // Exclude tfhe and @cofhe/sdk so esbuild doesn't bundle them — bundling
    // breaks `new URL('tfhe_bg.wasm', import.meta.url)` (wasm-bindgen pattern)
    // causing Vite to serve an HTML 404 instead of the binary.
    exclude: ['tfhe', 'node-tfhe', '@cofhe/sdk'],
    // iframe-shared-storage is CJS-only (no ESM build, no exports map).
    // Force Vite to pre-bundle it so esbuild converts it to ESM; without this
    // the raw `import { constructClient }` in @cofhe/sdk/dist/web.js throws
    // "does not provide an export named 'constructClient'".
    include: ['iframe-shared-storage'],
  },
}));
