import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { visualizer } from "rollup-plugin-visualizer";
import { sentryVitePlugin } from "@sentry/vite-plugin";

const deferredHtmlPreloadChunks = ["BoardPage", "dnd-kit", "supabase"];

// https://vite.dev/config/
export default defineConfig({
 plugins: [
  react(),
  tailwindcss(),
  visualizer({ open: false }),
  sentryVitePlugin({
   org: process.env.SENTRY_ORG,
   project: process.env.SENTRY_PROJECT,
   authToken: process.env.SENTRY_AUTH_TOKEN,
   sourcemaps: {
    filesToDeleteAfterUpload: ["dist/**/*.map"],
   },
  }),
 ],
 build: {
  sourcemap: true,
  modulePreload: {
   resolveDependencies(_url, deps, context) {
    if (context.hostType !== "html") {
     return deps;
    }

    return deps.filter(
     (dep) => !deferredHtmlPreloadChunks.some((chunkName) => dep.includes(chunkName)),
    );
   },
  },
  rolldownOptions: {
   output: {
    manualChunks(id) {
     if (id.includes("node_modules")) {
      //React 相關
      if (id.includes("react") || id.includes("react-dom") || id.includes("react-router")) {
       return "react-vendor";
      }
      if (id.includes("dnd-kit")) return "dnd-kit";
      if (
       id.includes("@supabase") ||
       id.includes("realtime-js") ||
       id.includes("postgrest-js") ||
       id.includes("gotrue-js") ||
       id.includes("storage-js")
      ) {
       return "supabase";
      }
     }
    },
   },
  },
 },
});
