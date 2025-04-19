import { authenticateShopify } from "./auth/handleInstall";
import { authenticateOrgShopify } from "./auth/orgAuth";
import { handleCallback } from "./auth/handleCallback";
import { verifyOAuthRequest as authenticateWebhook } from "./auth/verifyOAuthRequest";

export const handler = async (event: any) => {
  const path = event.rawPath || event.path || "";
  const routes: Record<string, (e: any) => Promise<any> | any> = {
    "/shopify/webhook": authenticateWebhook,
    "/shopify/auth": authenticateShopify,
    "/shopify/org-auth": (e) => authenticateOrgShopify(e),
    "/shopify/callback": handleCallback,
  };

  const routeHandler = routes[path];
  if (routeHandler) {
    return routeHandler(event);
  }

  return {
    statusCode: 404,
    body: JSON.stringify({ error: `Unknown route: ${path}` }),
  };
};