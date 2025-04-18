import { defineConfig, type UserConfig, loadEnv } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { vitePlugin as remix } from "@remix-run/dev";
import { installGlobals } from "@remix-run/node";

export default defineConfig(({ mode }) => {
  // ✅ Load .env based on mode (e.g., `.env.development`, `.env.production`)
  const env = loadEnv(mode, process.cwd(), "");

  installGlobals({ nativeFetch: true });

  // ✅ Ensure SHOPIFY_APP_URL is correctly set
  if (env.HOST && (!env.DROPX_APPLICATION_URL || env.DROPX_APPLICATION_URL === env.HOST)) {
    env.DROPX_APPLICATION_URL = env.HOST;
  }

  const host = new URL(env.DROPX_APPLICATION_URL || "http://localhost").hostname;

  let hmrConfig;
  if (host === "localhost") {
    hmrConfig = {
      protocol: "ws",
      host: "localhost",
      port: 8080,
      clientPort: 80,
    };
  } else {
    hmrConfig = {
      protocol: "wss",
      host: host,
      port: parseInt(env.FRONTEND_PORT!) || 8002,
      clientPort: 443,
    };
  }

  const requiredVars = [
    "VITE_DROPX_SHOPIFY_API_KEY",
    "VITE_DROPX_APPLICATION_URL",
    "VITE_DROPX_SCOPES"
  ];

  const missingVars = requiredVars.filter((key) => !env[key]);

  if (missingVars.length > 0) {
    console.warn(`⚠️ Missing frontend env vars: ${missingVars.join(", ")}`);
  }

  return {
    server: {
      port: Number(env.PORT || 8080),
      hmr: hmrConfig,
      fs: {
        allow: ["app", "node_modules"],
      },
    },
    define: {
      // ✅ Pass environment variables to Vite frontend
      "process.env.DROPX_SHOPIFY_STORE": JSON.stringify(env.VITE_DROPX_SHOPIFY_STORE),
      "process.env.ORG_SHOPIFY_STORE_URL": JSON.stringify(env.ORG_SHOPIFY_STORE_URL),
      "process.env.ADMIN_API_ACCESS_TOKEN": JSON.stringify(env.VITE_ADMIN_API_ACCESS_TOKEN),
      "process.env.SHOPIFY_WEBHOOK_SECRET": JSON.stringify(env.VITE_SHOPIFY_WEBHOOK_SECRET),
      "process.env.SCOPES": JSON.stringify(env.VITE_SCOPES), // ✅ Add SCOPES variable
      "process.env.DROPX_APPLICATION_URL": JSON.stringify(env.DROPX_APPLICATION_URL), // Expose DROPX_APPLICATION_URL
      "process.env.VITE_DROPX_SHOPIFY_STORE": JSON.stringify(env.VITE_DROPX_SHOPIFY_STORE),
      "process.env.VITE_ORG_SHOPIFY_STORE_URL": JSON.stringify(env.VITE_ORG_SHOPIFY_STORE_URL),
      "process.env.VITE_ADMIN_API_ACCESS_TOKEN": JSON.stringify(env.VITE_ADMIN_API_ACCESS_TOKEN),
      "process.env.VITE_SHOPIFY_WEBHOOK_SECRET": JSON.stringify(env.VITE_SHOPIFY_WEBHOOK_SECRET),
      "process.env.VITE_SCOPES": JSON.stringify(env.VITE_SCOPES),
    },
    plugins: [
      remix({
        ignoredRouteFiles: ["**/.*"],
        future: {
          v3_fetcherPersist: true,
          v3_relativeSplatPath: true,
          v3_throwAbortReason: true,
          v3_lazyRouteDiscovery: true,
          v3_singleFetch: false,
          v3_routeConfig: true,
        },
      }),
      tsconfigPaths(),
    ],
    build: {
      assetsInlineLimit: 0,
    },
    ssr: {
      external: ["@shopify/shopify-app-express"],
    },
  } satisfies UserConfig;
});