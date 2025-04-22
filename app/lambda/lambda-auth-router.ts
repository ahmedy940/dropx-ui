import { authenticateShopify } from "./auth/handleInstall";
import { handleCallback } from "./auth/handleCallback";

export const handler = async (event: any) => {
  const path = event.rawPath || event.path || "";
  console.info("[AUTH ROUTER] Incoming request path:", path);

  const routes: Record<string, (e: any) => Promise<any>> = {
    "/shopify/auth": authenticateShopify,
    "/shopify/callback": handleCallback,
  };

  const routeHandler = routes[path];
  if (routeHandler) return routeHandler(event);

  console.warn("[AUTH ROUTER] Unmatched path:", path);
  return {
    statusCode: 404,
    body: JSON.stringify({ error: `Unknown auth route: ${path}` }),
  };
};
