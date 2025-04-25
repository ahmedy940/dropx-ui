import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { authenticateOrgShopify } from "./auth/orgAuth";

// Internal route handler for Shopify authentication requests
type InternalHandler = (event: any) => Promise<any>;

const routes: Record<string, InternalHandler> = {
  "/shopify/org-auth": authenticateOrgShopify,
};

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const path = event.path || "";
  console.info("[SHOPIFY INTERNAL] Incoming request:", path);

  const handlerFn = routes[path];
  if (!handlerFn) {
    console.warn("[SHOPIFY INTERNAL] No route matched:", path);
    return {
      statusCode: 404,
      body: JSON.stringify({ error: `Unknown route: ${path}` }),
    };
  }

  try {
    return await handlerFn(event);
  } catch (error: any) {
    console.error("[SHOPIFY INTERNAL] Handler error:", path, error.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal handler error", message: error.message }),
    };
  }
};

export { authenticateOrgShopify };