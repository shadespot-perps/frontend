import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    {
      name: "shadespot-tweetnacl-default-shim",
      enforce: "pre",
      resolveId(source) {
        // Some deps (via @cofhe/sdk) import nacl-fast with a default import, but the module
        // doesn't provide a default export in Vite dev ESM. Force-resolve to our shim.
        const noQuery = source.split("?", 1)[0];
        if (
          noQuery === "tweetnacl/nacl-fast" ||
          noQuery === "tweetnacl/nacl-fast.js" ||
          noQuery === "/node_modules/tweetnacl/nacl-fast.js" ||
          noQuery.endsWith("/node_modules/tweetnacl/nacl-fast.js")
        ) {
          return path.resolve(__dirname, "./src/shims/tweetnacl-fast-default.ts");
        }
        return null;
      },
    },
    {
      name: "shadespot-tweetnacl-devserver-rewrite",
      // Vite's dev server can serve `/node_modules/...` URLs directly, bypassing
      // normal resolve/alias hooks. Intercept that specific URL and serve a
      // module that provides a `default` export.
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const url = req.url ?? "";
          if (url.startsWith("/node_modules/tweetnacl/nacl-fast.js")) {
            res.statusCode = 200;
            res.setHeader("Content-Type", "application/javascript; charset=utf-8");
            res.end(
              [
                // Use Vite's special /@id/ prefix so bare specifiers resolve even
                // though this response bypasses Vite's normal module transform.
                `import * as naclNS from '/@id/tweetnacl';`,
                `export default naclNS;`,
                `export * from '/@id/tweetnacl';`,
                ``,
              ].join("\n")
            );
            return;
          }
          next();
        });
      },
    },
    react(),
    mode === "development" && componentTagger(),
  ].filter(Boolean),
  worker: {
    // CoFHE SDK uses wasm-bindgen + web workers. ESM workers avoid Rollup's
    // "Invalid value iife for output.format" failure in code-splitting builds.
    format: 'es',
  },
  server: {
    host: "::",
    port: 8080,
    hmr: {
      // Keep overlay on so runtime bundling errors don't show as a blank screen.
      overlay: true,
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
  resolve: {
    alias: [
      { find: "@", replacement: path.resolve(__dirname, "./src") },
      // tweetnacl's nacl-fast entry doesn't expose a default export under Vite's dev ESM.
      // Some deps import it as `default`, so we alias both forms to a shim.
      { find: "tweetnacl/nacl-fast", replacement: path.resolve(__dirname, "./src/shims/tweetnacl-fast-default.ts") },
      { find: "tweetnacl/nacl-fast.js", replacement: path.resolve(__dirname, "./src/shims/tweetnacl-fast-default.ts") },
      // Some bundles end up importing the dev-server absolute path.
      { find: /\/node_modules\/tweetnacl\/nacl-fast\.js(\?.*)?$/, replacement: path.resolve(__dirname, "./src/shims/tweetnacl-fast-default.ts") },
    ],
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
