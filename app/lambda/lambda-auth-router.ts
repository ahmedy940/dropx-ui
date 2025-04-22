import { authenticateShopify } from "./auth/handleInstall";
import { handleCallback } from "./auth/handleCallback";

type AuthRouteHandler = (event: any) => Promise<any>;

const routes: Record<string, AuthRouteHandler> = {
  "/shopify/auth": authenticateShopify,
  "/shopify/callback": handleCallback,
};

export const handler = async (event: any) => {
  const path = event.rawPath || event.path || "";
  console.info("[AUTH ROUTER] Incoming request:", path);

  const handlerFn = routes[path];
  if (!handlerFn) {
    console.warn("[AUTH ROUTER] No handler for path:", path);
    return {
      statusCode: 404,
      body: JSON.stringify({ error: `Unknown auth route: ${path}` }),
    };
  }

  try {
    return await handlerFn(event);
  } catch (error: any) {
    console.error("[AUTH ROUTER] Handler failure for:", path, "→", error.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Auth handler error", message: error.message }),
    };
  }
};
