import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { authenticateShopify } from "./auth/handleInstall";
import { handleCallback } from "./auth/handleCallback";

type AuthRouteHandler = (event: APIGatewayProxyEvent) => Promise<APIGatewayProxyResult>;

const routes: Record<string, AuthRouteHandler> = {
  "/shopify/auth": authenticateShopify,
  "/shopify/callback": handleCallback,
};

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const path = event.path || "";
  const traceId = event.headers["X-Amzn-Trace-Id"] || `trace-${Date.now()}`;
  const method = event.httpMethod;
  console.info(`[INFO] [AUTH ROUTER] [${traceId}] Incoming ${method} request to: ${path}`);

  const handlerFn = routes[path];
  if (!handlerFn) {
    console.warn(`[WARN] [AUTH ROUTER] [${traceId}] No handler for path: ${path}`);
    return {
      statusCode: 404,
      body: JSON.stringify({ error: `Unknown auth route: ${path}` }),
    };
  }

  try {
    const start = Date.now();
    const response = await handlerFn(event);
    const duration = Date.now() - start;
    console.info(`[INFO] [AUTH ROUTER] [${traceId}] ${path} handled in ${duration}ms`);
    return response;
  } catch (error: any) {
    console.error(`[ERROR] [AUTH ROUTER] [${traceId}] Handler failure for: ${path} → ${error.message}`);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Auth handler error", message: error.message }),
    };
  }
};
