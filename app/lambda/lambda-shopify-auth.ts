/**
 * Legacy multi-route Lambda handler for internal Shopify app features.
 * This may be deprecated in favor of dedicated Lambda routes.
 * Current purpose: temporarily support org-auth and internal routing.
 */

import { authenticateOrgShopify } from "./auth/orgAuth";

export const handler = async (event: any) => {
  const path = event.rawPath || event.path || "";
  const routes: Record<string, (e: any) => Promise<any> | any> = {
    "/shopify/org-auth": (e) => authenticateOrgShopify(e),
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

export { authenticateOrgShopify };