## `app/auth-service/lambda/lambda-auth-router.ts`
```
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { authenticateShopify } from "app/auth-service/oauth-install.ts";
import { handleCallback } from "../oauth-callback.js"; // Ensure this file exists in the 'auth' directory

type AuthRouteHandler = (event: APIGatewayProxyEvent) => Promise<APIGatewayProxyResult>;

const routes: Record<string, AuthRouteHandler> = {
  "/shopify/auth": authenticateShopify,
  "/shopify/callback": handleCallback,
};

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const path = (event as any).rawPath || event.path || "";
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
```

## `app/auth-service/oauth-callback.ts`
```
import { getSSMParam } from "../utils/getSSMParam";
import { verifyOAuthRequest } from "app/auth-service/utils/verifyOAuthRequest"
import { redirectWithError } from "app/auth-service/utils/redirectWithError";
import { getOAuthState } from "app/auth-service/utils/stateStore";
import { validateCallbackQuery } from "./utils/validateCallbackQuery";
import { exchangeCodeForToken } from "./utils/exchangeCodeForToken";
import { fetchShopDetails } from "../lambda/utils/fetchShopDetails";
import { upsertShopInDb } from "../lambda/utils/upsertSopInDB";
import { buildRedirectUrl } from "./utils/buildRedirectUrl";

export const handleCallback = async (event: any) => {
  console.log("🔄 Handling OAuth callback");

  const DROPX_APPLICATION_URL = await getSSMParam("DROPX_APPLICATION_URL");
  if (!DROPX_APPLICATION_URL) {
    console.error("[Config] DROPX_APPLICATION_URL is not set in SSM");
    throw new Error("Missing DROPX_APPLICATION_URL");
  }

  try {
    const query = validateCallbackQuery(event.queryStringParameters || {});
    console.log("[Callback] Validated Query Params:", query);

    const appUrl = DROPX_APPLICATION_URL!;

    const isValid = await verifyOAuthRequest(query);
    if (!isValid) return redirectWithError("HMAC+verification+failed", appUrl);

    const storedState = getOAuthState(query.shop);
    if (!storedState || storedState !== query.state) {
      return redirectWithError("Invalid+or+expired+OAuth+state+parameter", appUrl);
    }

    const accessToken = await exchangeCodeForToken(query.shop as string, query.code);
    if (!accessToken) {
      return redirectWithError("Missing+access+token", appUrl);
    }
    const shopData = await fetchShopDetails(query.shop as string, accessToken);
    const { email, name } = await upsertShopInDb(query.shop, accessToken, shopData);

    const redirectUrl = await buildRedirectUrl(query.shop, email, name);
    console.log("✅ Redirecting to:", redirectUrl);

    return {
      statusCode: 302,
      headers: { Location: redirectUrl },
      body: "",
    };
  } catch (err: any) {
    console.error("[OAuth Callback Error]", err);
    return redirectWithError(encodeURIComponent(err.message || "Unknown error"), DROPX_APPLICATION_URL!);
  }
};```

## `app/auth-service/oauth-install.ts`
```
import { getSSMParam } from "../utils/getSSMParam";
import { createHmac, createHash, randomBytes } from "crypto";
import { upsertShop } from "../db/shop.db";
import { logActivity } from "../db/activityLog.db";
import { addSessionToDB } from "../db/session.db";
import { triggerMerchantSync } from "app/lambda/services/syncTrigger.service";
import { storeOAuthState } from "app/auth-service/utils/stateStore";

const SHOPIFY_APP_SCOPE = "read_analytics,write_checkouts,write_companies,write_customers,write_discounts,write_draft_orders,write_fulfillments,write_inventory,write_locales,write_locations,write_marketing_events,write_metaobjects,write_orders,write_payment_terms,write_price_rules,write_products,write_reports,write_resource_feedbacks,write_script_tags,write_shipping,write_themes,read_shop";

export const authenticateShopify = async (event: any) => {
  console.log("[INFO] Authenticating Shopify install request:", JSON.stringify(event, null, 2));

  try {
    const DROPX_SHOPIFY_API_KEY = await getSSMParam("DROPX_SHOPIFY_API_KEY");
    const DROPX_APPLICATION_URL = await getSSMParam("DROPX_APPLICATION_URL");
    if (!DROPX_APPLICATION_URL) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Missing application redirect URL." }),
      };
    }

    const { shop } = event.queryStringParameters || {};
    if (!shop) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing required shop parameter." }),
      };
    }

    const state = createHash("sha256").update(randomBytes(16)).digest("hex");

    storeOAuthState(shop, state);

    const redirectToShopifyOAuth = `https://${shop}/admin/oauth/authorize?client_id=${DROPX_SHOPIFY_API_KEY}&scope=${SHOPIFY_APP_SCOPE}&redirect_uri=${encodeURIComponent(DROPX_APPLICATION_URL + "/shopify/callback")}&state=${state}`;

    console.log("[INFO] [Install] Redirecting to:", redirectToShopifyOAuth);
    console.log("[INFO] [Install] OAuth state:", state);

    return {
      statusCode: 302,
      headers: {
        Location: redirectToShopifyOAuth,
      },
      body: "",
    };
  } catch (error) {
    console.error("[ERROR] OAuth Install Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal Server Error during OAuth" }),
    };
  }
};
```

## `app/auth-service/utils/buildRedirectUrl.ts`
```


import { getSSMParam } from "../../utils/getSSMParam";

export async function buildRedirectUrl(shop: string, email: string, name: string) {
  const POST_INSTALL_URL = await getSSMParam("DROPX_POST_INSTALL_REDIRECT");
  if (!POST_INSTALL_URL) throw new Error("Missing post-install URL");

  return `${POST_INSTALL_URL}?shop=${encodeURIComponent(shop)}&email=${encodeURIComponent(email)}&shopName=${encodeURIComponent(name)}`;
}```

## `app/auth-service/utils/exchangeCodeForToken.ts`
```


import { exchangeShopifyToken } from "./exchangeShopifyToken";
import { getSSMParam } from "../../utils/getSSMParam";

export async function exchangeCodeForToken(shop: string, code: string) {
  const apiKey = await getSSMParam("DROPX_SHOPIFY_API_KEY");
  const apiSecret = await getSSMParam("DROPX_SHOPIFY_API_SECRET");
  if (!apiKey || !apiSecret) throw new Error("Missing API credentials");

  return exchangeShopifyToken(shop, code, apiKey, apiSecret);
}```

## `app/auth-service/utils/exchangeShopifyToken.ts`
```
export async function exchangeShopifyToken(shop: string, code: string, clientId: string, clientSecret: string): Promise<string | null> {
  const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
    }),
  });

  const rawBody = await tokenRes.text();

  if (!tokenRes.ok) {
    console.error(`[Shopify Token Exchange] Failed with status ${tokenRes.status}`);
    console.error("[Shopify Token Exchange] Response body:", rawBody);
    return null;
  }

  try {
    const tokenData = JSON.parse(rawBody);
    return tokenData.access_token || null;
  } catch (err) {
    console.error("[Shopify Token Exchange] Failed to parse token JSON", err);
    return null;
  }
}
```

## `app/auth-service/utils/redirectWithError.ts`
```
export const redirectWithError = (message: string, baseUrl: string) => ({
  statusCode: 302,
  headers: {
    Location: `${baseUrl}/auth/error?message=${encodeURIComponent(message)}`,
  },
  body: "",
});
```

## `app/auth-service/utils/stateStore.ts`
```
type StateEntry = {
  value: string;
  expiresAt: number;
};

const stateStore: Map<string, StateEntry> = new Map();

/**
 * Stores a temporary OAuth state for a given shop, valid for a limited time.
 */
export function storeOAuthState(shop: string, state: string, ttlMs = 5 * 60 * 1000): void {
  const existing = stateStore.get(shop);
  const now = Date.now();

  if (existing && existing.expiresAt > now) {
    console.log(`[INFO] [StateStore] State already exists for ${shop}, skipping overwrite.`);
    return;
  }

  const expiresAt = now + ttlMs;
  stateStore.set(shop, { value: state, expiresAt });
  console.log(`[INFO] [StateStore] Stored state for ${shop}: ${state}`);
}

/**
 * Retrieves the stored OAuth state for a shop, if valid.
 */
export function getOAuthState(shop: string): string | null {
  const entry = stateStore.get(shop);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    console.warn(`[WARN] [StateStore] OAuth state expired for ${shop}`);
    stateStore.delete(shop);
    return null;
  }
  return entry.value;
}```

## `app/auth-service/utils/validateCallbackQuery.ts`
```


export function validateCallbackQuery(query: Record<string, string | undefined>) {
  const { shop, hmac, code, state } = query;
  if (!shop || !hmac || !code || !state) {
    throw new Error("Missing required OAuth parameters");
  }
  return { shop, hmac, code, state };
}```

## `app/auth-service/utils/validateInstallQuery.ts`
```
import { extractQueryParams } from "../../lambda/utils/queryString";

export function validateInstallQuery(query: Record<string, string | undefined>) {
  const extracted = extractQueryParams(query);
  console.info("[INFO] Extracted query parameters:", extracted);
  if ("error" in extracted) {
    console.warn("[WARN] Error found in query parameters:", extracted.error);
    throw new Error(extracted.error);
  }
  return extracted;
}
```

## `app/auth-service/utils/verifyOAuthRequest.ts`
```
import { createHmac, timingSafeEqual } from "crypto";
import { getSSMParam } from "../../utils/getSSMParam";

/**
 * Verifies Shopify HMAC signature from OAuth or Webhook requests.
 * Returns true if verification succeeds, false otherwise.
 */
export const verifyOAuthRequest = async (
  queryParams: Record<string, string | undefined>
): Promise<boolean> => {
  const DROPX_SHOPIFY_API_SECRET = await getSSMParam("DROPX_SHOPIFY_API_SECRET");

  const sortedParams = Object.entries(queryParams)
    .filter(([key]) => key !== "hmac")
    .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");

  const generatedHmac = createHmac("sha256", DROPX_SHOPIFY_API_SECRET!)
    .update(sortedParams)
    .digest("hex");

  const receivedHmac = queryParams.hmac ?? "";
  const hmacBuffer = Buffer.from(generatedHmac, "utf-8");
  const receivedBuffer = Buffer.from(receivedHmac, "utf-8");

  if (hmacBuffer.length !== receivedBuffer.length) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[verifyOAuthRequest] HMAC length mismatch");
    }
    return false;
  }
  const isValid = timingSafeEqual(hmacBuffer, receivedBuffer);
  if (!isValid && process.env.NODE_ENV !== "production") {
    console.warn("[verifyOAuthRequest] HMAC value mismatch", {
      expected: generatedHmac,
      received: receivedHmac
    });
  }
  return isValid;
};```

## `app/db/activityLog.db.ts`
```
import { getPrisma } from "./prisma";
import { handleError } from "./errors";

/**
 * ✅ Logs an activity related to a shop.
 */
export async function logActivity(shopDomain: string, action: string) {
    try {
        const prisma = await getPrisma();
        console.log(`[ACTIVITY LOG]: Logging action '${action}' for shop (${shopDomain})`);

        return await prisma.activityLog.create({
            data: {
                shopDomain,
                action,
            },
        });
    } catch (error) {
        console.error(`[DB ERROR]: Failed to log activity for shop (${shopDomain}) - ${handleError(error)}`);
        throw new Error("Error logging activity.");
    }
}

/**
 * ✅ Fetch activity logs for a specific shop.
 */
export async function getActivityLogs(shopDomain: string) {
    try {
        const prisma = await getPrisma();
        console.log(`[ACTIVITY LOG]: Fetching logs for shop (${shopDomain})`);

        return await prisma.activityLog.findMany({
            where: { shopDomain },
            orderBy: { createdAt: "desc" },
        });
    } catch (error) {
        console.error(`[DB ERROR]: Failed to fetch activity logs for shop (${shopDomain}) - ${handleError(error)}`);
        throw new Error("Error fetching activity logs.");
    }
}

/**
 * ✅ Clear all activity logs for a shop.
 */
export async function deleteActivityLogs(shopDomain: string) {
    try {
        const prisma = await getPrisma();
        console.log(`[ACTIVITY LOG]: Deleting logs for shop (${shopDomain})`);

        return await prisma.activityLog.deleteMany({
            where: { shopDomain },
        });
    } catch (error) {
        console.error(`[DB ERROR]: Failed to delete activity logs for shop (${shopDomain}) - ${handleError(error)}`);
        throw new Error("Error deleting activity logs.");
    }
}```

## `app/db/config.ts`
```
import { getSSMParam } from "../utils/getSSMParam";

export async function getDropxConfig() {
  const DROPX_SHOPIFY_API_KEY = await getSSMParam("/dropx/dev/DROPX_SHOPIFY_API_KEY");
  const DROPX_SHOPIFY_API_SECRET = await getSSMParam("/dropx/dev/DROPX_SHOPIFY_API_SECRET");
  const DROPX_APPLICATION_URL = await getSSMParam("/dropx/dev/DROPX_APPLICATION_URL");
  const DROPX_DATABASE_URL = await getSSMParam("/dropx/dev/DROPX_DATABASE_URL");

  const ORG_SHOPIFY_STORE_URL = await getSSMParam("/dropx/dev/ORG_SHOPIFY_STORE_URL");
  const ORG_SHOPIFY_API_KEY = await getSSMParam("/dropx/dev/ORG_SHOPIFY_API_KEY");
  const ORG_SHOPIFY_API_SECRET = await getSSMParam("/dropx/dev/ORG_SHOPIFY_API_SECRET");
  const ORG_SHOPIFY_ADMIN_API_TOKEN = await getSSMParam("/dropx/dev/ORG_SHOPIFY_ADMIN_API_TOKEN");

  const SHOPIFY_APP_PROXY_SUBPATH = await getSSMParam("/dropx/dev/ORG_SHOPIFY_APP_PROXY_SUBPATH");
  const SHOPIFY_APP_PROXY_BASE_URL = await getSSMParam("/dropx/dev/ORG_SHOPIFY_APP_PROXY_BASE_URL");

  const SHOPIFY_API_VERSION = await getSSMParam("/dropx/dev/SHOPIFY_API_VERSION");
  const SHOPIFY_WEBHOOK_SECRET = await getSSMParam("/dropx/dev/SHOPIFY_WEBHOOK_SECRET");
  const SHOPIFY_SCOPES = await getSSMParam("/dropx/dev/SHOPIFY_SCOPES");

  const ORG_SHOPIFY_GRAPHQL_ENDPOINT = `https://${ORG_SHOPIFY_STORE_URL}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`;

  const SHADOW_DATABASE_URL = await getSSMParam("/dropx/dev/SHADOW_DATABASE_URL");

  return {
    DROPX_SHOPIFY_API_KEY,
    DROPX_SHOPIFY_API_SECRET,
    DROPX_APPLICATION_URL,
    DROPX_DATABASE_URL,
    ORG_SHOPIFY_STORE_URL,
    ORG_SHOPIFY_API_KEY,
    ORG_SHOPIFY_API_SECRET,
    ORG_SHOPIFY_ADMIN_API_TOKEN,
    SHOPIFY_APP_PROXY_SUBPATH,
    SHOPIFY_APP_PROXY_BASE_URL,
    SHOPIFY_API_VERSION,
    SHOPIFY_WEBHOOK_SECRET,
    SHOPIFY_SCOPES,
    ORG_SHOPIFY_GRAPHQL_ENDPOINT,
    SHADOW_DATABASE_URL,
  };
}```

## `app/db/errors.ts`
```
export function handleError(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return "An unknown error occurred.";
  }```

## `app/db/index.ts`
```
export * from "./prisma";
export * from "./config";
export * from "./errors";
export * from "./shop.db";
export * from "./session.db";
// export * from "./user.db";
export * from "./activityLog.db"; // ✅ Add Activity Log Support```

## `app/db/prisma.ts`
```
import { PrismaClient } from "@prisma/client";
import { getSSMParam } from "../utils/getSSMParam";

let prisma: PrismaClient;

const getPrisma = async (): Promise<PrismaClient> => {
  if (!prisma) {
    const dbUrl = await getSSMParam("DROPX_DATABASE_URL");
    if (!dbUrl) throw new Error("❌ Failed to load DROPX_DATABASE_URL from SSM");

    prisma = new PrismaClient({
      datasources: {
        db: { url: dbUrl },
      },
    });
  }

  return prisma;
};

export { getPrisma };```

## `app/db/session.db.ts`
```
import { getPrisma } from "./prisma";
import { handleError } from "./errors";

/**
 * ✅ Stores an installation session in the `Session` table.
 */
export async function addSessionToDB(sessionData: {
    shopDomain: string;
    state: string;
    isOnline: boolean | undefined;
    scope: string | null | undefined;
    accessToken: string;
    expires: string | Date | null | undefined;
    email: string | null | undefined;
}) {
    try {
        console.log(`[DB]: Storing session for shop (${sessionData.shopDomain})`);
        const prisma = await getPrisma();

        return await prisma.session.upsert({
            where: { shopDomain: sessionData.shopDomain }, // ✅ Reference shopDomain directly
            update: {
                accessToken: sessionData.accessToken,
                state: sessionData.state,
                isOnline: sessionData.isOnline,
                scope: sessionData.scope,
                expires: sessionData.expires,
                email: sessionData.email,
                updatedAt: new Date(),
            },
            create: {
                shopDomain: sessionData.shopDomain, // ✅ Directly store the domain instead of relation
                accessToken: sessionData.accessToken,
                state: sessionData.state,
                isOnline: sessionData.isOnline,
                scope: sessionData.scope,
                expires: sessionData.expires,
                email: sessionData.email,
                createdAt: new Date(),
                updatedAt: new Date(),
            },
        });
    } catch (error) {
        console.error(`[DB ERROR]: Failed to store session for shop (${sessionData.shopDomain}) - ${handleError(error)}`);
        throw new Error("Error storing session in database.");
    }
}

/**
 * ✅ Fetches the active session for a shop by `shopDomain`
 */
export async function getShopSession(shopDomain: string) {
    try {
        console.log(`[DB]: Fetching active session for shop (${shopDomain})`);
        const prisma = await getPrisma();

        return await prisma.session.findUnique({
            where: { shopDomain }, // ✅ Lookup directly by shopDomain
        });
    } catch (error) {
        console.error(`[DB ERROR]: Failed to fetch session for shop (${shopDomain}) - ${handleError(error)}`);
        throw new Error("Error fetching shop session.");
    }
}

/**
 * ✅ Deletes a session when the shop logs out.
 */
export async function deleteShopSession(shopDomain: string) {
    try {
        console.log(`[DB]: Deleting session for shop (${shopDomain})`);
        const prisma = await getPrisma();

        return await prisma.session.deleteMany({
            where: { shopDomain }, // ✅ Delete session directly via shopDomain
        });
    } catch (error) {
        console.error(`[DB ERROR]: Failed to delete session for shop (${shopDomain}) - ${handleError(error)}`);
        throw new Error("Error deleting shop session.");
    }
}```

## `app/db/shop.db.ts`
```
import { getPrisma } from "./prisma";

/**
 * Fetch shop details by email
 * @param email - The unique shop email
 * @returns The shop record
 */
export async function getShopByEmail(email: string) {
  const prisma = await getPrisma();
  return await prisma.shop.findUnique({
    where: { email },
  });
}

/**
 * Fetch shop details by shop domain
 * @param shopDomain - The unique shop domain (myshopify domain)
 * @returns The shop record
 */
export async function getShopByDomain(shopDomain: string) {
  const prisma = await getPrisma();
  return await prisma.shop.findUnique({
    where: { shopDomain },
  });
}

/**
 * Create or update shop details in the database
 * @param shopData - Object containing shop information
 * @returns The created or updated shop record
 */
export async function upsertShop(shopData: {
  shopDomain: string;
  email: string;
  name: string;
  primaryDomain?: string;
  currencyCode?: string;
  timezone?: string;
  plan?: string;
  isCheckoutSupported?: boolean;
  accessToken?: string;
}) {
  const prisma = await getPrisma();
  return await prisma.shop.upsert({
    where: { email: shopData.email }, // ✅ Using email as the main identifier
    update: {
      shopDomain: shopData.shopDomain,
      name: shopData.name,
      primaryDomain: shopData.primaryDomain,
      currencyCode: shopData.currencyCode,
      timezone: shopData.timezone,
      plan: shopData.plan,
      isCheckoutSupported: shopData.isCheckoutSupported,
      accessToken: shopData.accessToken,
      updatedAt: new Date(),
    },
    create: {
      shopDomain: shopData.shopDomain,
      email: shopData.email,
      name: shopData.name,
      primaryDomain: shopData.primaryDomain,
      currencyCode: shopData.currencyCode,
      timezone: shopData.timezone,
      plan: shopData.plan,
      isCheckoutSupported: shopData.isCheckoutSupported ?? true,
      accessToken: shopData.accessToken,
    },
  });
}

/**
 * Delete a shop by email (e.g., on uninstallation)
 * @param email - The shop email to delete
 * @returns The deleted shop record
 */
export async function deleteShop(email: string) {
  const prisma = await getPrisma();
  return await prisma.shop.delete({
    where: { email },
  });
}

/**
 * Check if a shop exists in the database
 * @param email - The shop email
 * @returns Boolean indicating whether the shop exists
 */
export async function shopExists(email: string) {
  const prisma = await getPrisma();
  const shop = await prisma.shop.findUnique({
    where: { email },
    select: { id: true },
  });
  return !!shop;
}```

## `app/entry.server.tsx`
```
import { PassThrough, Readable } from "stream";
import { RemixServer } from "@remix-run/react";
import type { EntryContext } from "@remix-run/node";
import { renderToPipeableStream } from "react-dom/server";
import LRUCache from "lru-cache"; // ✅ Added Cache Layer

/**
 * ✅ Securely retrieve environment variables
 */
const getEnvVar = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    console.error(`🚨 Missing required environment variable: ${key}`);
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

// ✅ Updated Environment Variables (Using Latest `.env`)
const DROPX_SHOPIFY_API_KEY = getEnvVar("DROPX_SHOPIFY_API_KEY");
const DROPX_SHOPIFY_API_SECRET = getEnvVar("DROPX_SHOPIFY_API_SECRET");
const DROPX_APPLICATION_URL = getEnvVar("DROPX_APPLICATION_URL");
const DROPX_DATABASE_URL = getEnvVar("DROPX_DATABASE_URL");

const ORG_SHOPIFY_STORE_URL = getEnvVar("ORG_SHOPIFY_STORE_URL");
const ORG_SHOPIFY_API_KEY = getEnvVar("ORG_SHOPIFY_API_KEY");
const ORG_SHOPIFY_API_SECRET = getEnvVar("ORG_SHOPIFY_API_SECRET");
const ORG_SHOPIFY_ADMIN_API_TOKEN = getEnvVar("ORG_SHOPIFY_ADMIN_API_TOKEN");
const ORG_SHOPIFY_STOREFRONT_TOKEN = getEnvVar("ORG_SHOPIFY_STOREFRONT_TOKEN");

const SHOPIFY_APP_PROXY_SUBPATH = getEnvVar("SHOPIFY_APP_PROXY_SUBPATH");
const SHOPIFY_APP_PROXY_BASE_URL = getEnvVar("SHOPIFY_APP_PROXY_BASE_URL");

// ✅ Added LRU Cache to optimize data fetching
const cache = new LRUCache({
  max: 1000, // Max cache entries
  ttl: 1000 * 60 * 5, // Cache for 5 minutes
});

export default function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  remixContext: EntryContext
) {
  return new Promise((resolve, reject) => {
    let didError = false;

    const { pipe, abort } = renderToPipeableStream(
      <RemixServer context={remixContext} url={request.url} />,
      {
        onShellReady: () => {
          try {
            const passthrough = new PassThrough();
            const stream = new ReadableStream({
              start(controller) {
                passthrough.on("data", (chunk) => controller.enqueue(chunk));
                passthrough.on("end", () => controller.close());
                passthrough.on("error", (err) => {
                  console.error("[ENTRY.SERVER ERROR]: Stream error:", err);
                  controller.error(err);
                });
              },
            });

            responseHeaders.set("Content-Type", "text/html");
            pipe(passthrough);

            resolve(
              new Response(stream, {
                status: didError ? 500 : responseStatusCode,
                headers: responseHeaders,
              })
            );
          } catch (error) {
            console.error("[ENTRY.SERVER ERROR]: Failed to process stream:", error);
            reject(error);
          }
        },
        onShellError: (err) => {
          console.error("[ENTRY.SERVER ERROR]: Shell rendering failed:", err);
          reject(err);
        },
        onError: (error) => {
          didError = true;
          console.error("[ENTRY.SERVER ERROR]: Unexpected error:", error);
        },
      }
    );

    // 🚀 **Increased Timeout to 15 Seconds**
    setTimeout(() => {
      console.warn("[ENTRY.SERVER]: Rendering took too long, aborting...");
      abort();
    }, 15000); // ⏳ Increased timeout from **7s** to **15s** for Heroku cold starts
  });
}```

## `app/globals.d.ts`
```
declare module "*.css";
```

## `app/lambda/lambda-check-merchant.ts`
```
import { findMerchantByDomain } from "./services/merchant.service";
import { v4 as uuidv4 } from "uuid";
import { APIGatewayProxyEvent } from "aws-lambda";

export const handler = async (event: APIGatewayProxyEvent) => {
  const traceId = uuidv4();
  console.info(`[INFO][${traceId}] Incoming event: ${JSON.stringify(event)}`);

  try {
    const body = JSON.parse(event.body || "{}");
    const { shopDomain } = body;

    if (!shopDomain) {
      console.warn(`[WARN][${traceId}] Missing shopDomain in request body.`);
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing shopDomain in request body." }),
      };
    }

    const merchant = await findMerchantByDomain(shopDomain);

    console.info(`[INFO][${traceId}] Merchant found: ${!!merchant}`);

    return {
      statusCode: 200,
      body: JSON.stringify({ found: !!merchant, merchantId: merchant?.id || null }),
    };
  } catch (error) {
    console.error(`[ERROR][${traceId}] Error checking merchant domain:`, error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal server error." }),
    };
  }
};
```

## `app/lambda/lambda-check-org-customer.ts`
```
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { findMerchantByDomain } from "./services/merchant.service";
import { checkCustomerExists } from "./services/shopify-org.service";
import { getSSMParam } from "../utils/getSSMParam";

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    let body;
    try {
      body = JSON.parse(event.body || "{}");
    } catch (parseErr) {
      console.error("[ERROR] Invalid JSON body", parseErr);
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Invalid JSON in request body." }),
      };
    }

    console.info("[Request Body]", body);
    const { shopDomain } = body;

    if (!shopDomain) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing shopDomain in request body." }),
      };
    }

    const merchant = await findMerchantByDomain(shopDomain);
    if (!merchant) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: "Merchant not found in DropX database." }),
      };
    }

    const email = merchant.email;
    console.info("[Merchant Email]", email);
    if (!email) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Merchant does not have an email." }),
      };
    }

    const orgUrl = await getSSMParam("DROPX_SHOPIFY_ORG_STORE_URL");
    const orgToken = await getSSMParam("DROPX_SHOPIFY_ORG_ADMIN_TOKEN");

    if (!orgUrl || !orgToken) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Missing org store configuration in SSM." }),
      };
    }

    const exists = await checkCustomerExists(email, orgUrl, orgToken);
    console.info("[Customer Exists]", exists);

    return {
      statusCode: 200,
      body: JSON.stringify({ needsRegistration: !exists }),
    };
  } catch (error) {
    const body = event.body || "{}";
    let shopDomain = "";
    try {
      shopDomain = JSON.parse(body).shopDomain || "";
    } catch {
      shopDomain = "";
    }
    console.error(`[ERROR] Failed for shopDomain: ${shopDomain}`, error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal server error." }),
    };
  }
};```

## `app/lambda/lambda-create-org-customer.ts`
```
import { findMerchantByDomain } from "./services/merchant.service";
import { createCustomerInOrg } from "./services/shopify-org.service";
import { getSSMParam } from "../utils/getSSMParam";

export const handler = async (event: any) => {
  try {
    const body = JSON.parse(event.body || "{}");
    const { shopDomain } = body;

    if (!shopDomain) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing shopDomain in request body." }),
      };
    }

    const merchant = await findMerchantByDomain(shopDomain);
    if (!merchant) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: "Merchant not found in DropX." }),
      };
    }

    const email = merchant.email;
    const shopName = merchant.name;

    if (!email || !shopName) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Merchant record missing email or name." }),
      };
    }

    const orgUrl = await getSSMParam("DROPX_SHOPIFY_ORG_STORE_URL");
    const orgToken = await getSSMParam("DROPX_SHOPIFY_ORG_ADMIN_TOKEN");

    if (!orgUrl || !orgToken) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Missing org store configuration in SSM." }),
      };
    }

    await createCustomerInOrg(email, shopName, orgUrl, orgToken);

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, message: "Customer created in org store." }),
    };
  } catch (error) {
    console.error("Error creating org customer:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal server error." }),
    };
  }
};```

## `app/lambda/lambda-post-install.ts`
```
import { APIGatewayProxyEvent } from "aws-lambda";
import { validateInstallQuery } from "../auth-service/utils/validateInstallQuery";
import { decideNextStep } from "./utils/handleMerchantRouting";
import { triggerMerchantSync } from "./services/syncTrigger.service";

export const handler = async (event: APIGatewayProxyEvent) => {
  console.info("[INFO] 🛬 Arrived at postInstallHandler", event);

  try {
    const { shop, email, shopName } = validateInstallQuery(event.queryStringParameters || {});
    if (!shop || !email) {
      console.warn("[WARN] Missing shop or email in query params:", { shop, email });
      return decideNextStep(shop, email, shopName, true);
    }

    const { ok, message, needsRegistration } = await triggerMerchantSync(shop, email, shopName);
    console.info("[INFO] ✅ triggerMerchantSync result:", message);

    return decideNextStep(shop, email, shopName, needsRegistration);
  } catch (e) {
    console.error("[ERROR] ❌ Post-install failed:", e);
    return {
      statusCode: 500,
      headers: { "Content-Type": "text/html" },
      body: renderErrorHtml((e as any)?.message || "Internal error occurred during installation."),
    };
  }
};

const renderErrorHtml = (message: string) => `
  <div style="font-family:sans-serif;padding:2rem;text-align:center;">
    <h1>😓 Oops! Something went wrong</h1>
    <p>${message}</p>
  </div>
`;
```

## `app/lambda/lambda-proxy.ts`
```
import fetch from "node-fetch";
import { authenticateOrgShopify } from "./lambda-shopify-auth";
import { handleProductWebhook as handleProductAddWebhook } from "./webhook/webhook-product";

/**
 * ✅ AWS Lambda Proxy Handler
 */
export const handler = async (event: any) => {
  console.log("Incoming Proxy Event:", JSON.stringify(event, null, 2));

  const { httpMethod, queryStringParameters, headers, body } = event;
  let response;

  try {
    const endpoint = queryStringParameters?.endpoint;
    const shop = queryStringParameters?.shop;

    if (!endpoint) {
      console.error("[PROXY ERROR]: Missing endpoint parameter.");
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing endpoint parameter" }),
      };
    }

    if (endpoint === "product-add-webhook") {
      if (httpMethod !== "POST") {
        return {
          statusCode: 405,
          body: JSON.stringify({ error: "Method Not Allowed" }),
        };
      }

      console.log(`[PROXY]: Handling product add webhook...`);
      return await handleProductAddWebhook(event);
    }

    // ✅ Handle Merchant Sync API Proxying
    if (endpoint === "merchant-sync") {
      return await fetchProxy("https://your-app.com/api/merchant.sync", httpMethod, headers, body);
    }

    // ✅ Handle Product Fetch API Proxying
    if (endpoint === "product-fetch") {
      return await fetchProxy("https://your-app.com/api/product.fetch", httpMethod, headers, body);
    }

    // ✅ Handle Product Sync API Proxying
    if (endpoint === "product-sync") {
      return await fetchProxy("https://your-app.com/api/product.sync", httpMethod, headers, body);
    }

    // ✅ Secure API Request Forwarding to Organization Shopify Admin API
    const authResult = await authenticateOrgShopify(shop);
    if ('statusCode' in authResult && 'body' in authResult) {
      return authResult;
    }
    const storeUrl = authResult.shopDomain;
    const adminToken = authResult.accessToken;
    console.log(`[PROXY]: Forwarding request to ${storeUrl}/admin/api/2025-01/${endpoint}.json`);

    return await fetchProxy(`https://${storeUrl}/admin/api/2025-01/${endpoint}.json`, httpMethod, {
      "X-Shopify-Access-Token": adminToken,
      "Content-Type": "application/json",
    });

  } catch (error) {
    console.error("[PROXY ERROR]:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal Server Error" }),
    };
  }
};

/**
 * ✅ Generic Fetch Proxy Function
 */
const fetchProxy = async (url: string, method: string, headers: any, body?: any) => {
  try {
    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      console.error(`[PROXY ERROR]: Failed to fetch data from ${url}`);
      return {
        statusCode: response.status,
        body: JSON.stringify({ error: `Failed to fetch data from ${url}` }),
      };
    }

    const data = await response.json();
    console.log(`[PROXY]: Successfully fetched data from ${url}`);

    return {
      statusCode: 200,
      body: JSON.stringify(data),
    };
  } catch (error) {
    console.error("[FETCH PROXY ERROR]:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Fetch Proxy Internal Server Error" }),
    };
  }
};```

## `app/lambda/lambda-shopify-auth.ts`
```
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

export { authenticateOrgShopify };```

## `app/lambda/lambda-shopify-graphql.ts`
```
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";

/**
 * ✅ GraphQL Queries & Mutations for Shopify Store Management
 */

// 🔹 Fetch Shop Details
export const FETCH_SHOP_QUERY = `
  query {
    shop {
      myshopifyDomain
      name
      email
      primaryDomain { url }
      currencyCode
      ianaTimezone
      plan { displayName }
      checkoutApiSupported
      createdAt
      updatedAt
    }
  }
`;

// 🔹 Check if a Customer Exists
export const CHECK_CUSTOMER_QUERY = `
  query checkCustomer($email: String!) {
    customers(first: 1, query: "email:$email") {
      edges {
        node {
          id
          email
        }
      }
    }
  }
`;

// 🔹 Create a New Customer
export const CREATE_CUSTOMER_MUTATION = `
  mutation createCustomer($input: CustomerInput!) {
    customerCreate(input: $input) {
      customer {
        id
        email
      }
      userErrors {
        field
        message
      }
    }
  }
`;

// 🔹 Fetch Store Products
export const FETCH_PRODUCTS_QUERY = `
  query {
    products(first: 50) {
      edges {
        node {
          id
          title
          descriptionHtml
          vendor
          productType
          handle
          createdAt
          updatedAt
          images(first: 5) {
            edges {
              node {
                originalSrc
                altText
              }
            }
          }
          variants(first: 10) {
            edges {
              node {
                id
                title
                price
                sku
              }
            }
          }
        }
      }
    }
  }
`;

// 🔹 Check if a Product Exists
export const CHECK_PRODUCT_QUERY = `
  query checkProduct($title: String!) {
    products(first: 1, query: "title:$title") {
      edges {
        node {
          id
          title
        }
      }
    }
  }
`;

// 🔹 Create a New Product
export const CREATE_PRODUCT_MUTATION = `
  mutation createProduct($input: ProductInput!) {
    productCreate(input: $input) {
      product {
        id
        title
      }
      userErrors {
        field
        message
      }
    }
  }
`;

// 🔹 Update an Existing Product
export const UPDATE_PRODUCT_MUTATION = `
  mutation updateProduct($id: ID!, $input: ProductInput!) {
    productUpdate(id: $id, input: $input) {
      product {
        id
        title
      }
      userErrors {
        field
        message
      }
    }
  }
`;

// 🔹 Delete a Product
export const DELETE_PRODUCT_MUTATION = `
  mutation deleteProduct($id: ID!) {
    productDelete(input: { id: $id }) {
      deletedProductId
      userErrors {
        field
        message
      }
    }
  }
`;

/**
 * ✅ Generic Function to Send GraphQL Requests
 */
export const graphqlRequest = async (
  query: string,
  shopDomain: string,
  accessToken: string,
  variables?: any
) => {
  try {
    const response = await fetch(`https://${shopDomain}/admin/api/2024-10/graphql.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken,
      },
      body: JSON.stringify({ query, variables }),
    });

    const data = await response.json();

    if (!data || data.errors) {
      console.error("[ERROR] [GRAPHQL ERROR]:", data.errors || "Unknown error");
      return { success: false, error: data.errors };
    }

    return { success: true, data };
  } catch (error) {
    console.error("[ERROR] [API ERROR]: GraphQL request failed.", error);
    return { success: false, error };
  }
};

/**
 * ✅ AWS Lambda Handler - Handles API Gateway Requests
 */
export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const { path, httpMethod, queryStringParameters, body } = event;
  console.info("[INFO] [HANDLER START]:", { path, httpMethod });

  let response;

  try {
    if (httpMethod === "POST") {
      const parsedBody = body ? JSON.parse(body) : {};
      const { shopDomain, accessToken, query, variables } = parsedBody;

      if (!shopDomain || !accessToken || !query) {
        console.warn("[WARN] [MISSING PARAMS]:", { shopDomain, accessToken, query });
        throw new Error("Missing required parameters");
      }

      response = await graphqlRequest(query, shopDomain, accessToken, variables);

      if (response.success) {
        console.info("[INFO] [GRAPHQL SUCCESS]");
      } else {
        console.error("[ERROR] [GRAPHQL FAILURE]:", response.error);
      }
    } else {
      response = { error: "Invalid Route or Method" };
    }

    const statusCode = response && response.success ? 200 : 400;
    return {
      statusCode,
      body: JSON.stringify(response),
    };
  } catch (error) {
    console.error("[ERROR] [Handler]", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: "Internal Server Error" }),
    };
  }
};```

## `app/lambda/lambda-shopify-product.ts`
```
import { graphqlRequest } from "./lambda-shopify-graphql"; // Adjust import if needed

import { getSSMParam } from "../utils/getSSMParam";

/**
 * ✅ Fetch Product Details from Organization Store (AWS Lambda Version)
 */
export const fetchProductFromOrgStore = async (productId: string) => {
  console.info(`[INFO] [ORG STORE]: Fetching product ${productId}...`);

  const query = `
    query FetchProduct($id: ID!) {
      product(id: $id) {
        id
        title
        bodyHtml
        vendor
        productType
        variants(first: 10) {
          edges {
            node {
              id
              price
              sku
              inventoryQuantity
            }
          }
        }
        images(first: 5) {
          edges {
            node {
              src
            }
          }
        }
      }
    }
  `;

  const variables = { id: `gid://shopify/Product/${productId}` };

  try {
    const [ORG_SHOPIFY_STORE_URL, ORG_SHOPIFY_ADMIN_API_TOKEN] = await Promise.all([
      getSSMParam("ORG_SHOPIFY_STORE_URL"),
      getSSMParam("ORG_SHOPIFY_ADMIN_API_TOKEN")
    ]);
    const response = await graphqlRequest(
      query,
      ORG_SHOPIFY_STORE_URL || "",
      ORG_SHOPIFY_ADMIN_API_TOKEN || "",
      variables
    );
    return response.data?.product || null;
  } catch (error) {
    console.error("[ERROR] [GRAPHQL ERROR]: Failed to fetch product", error);
    return null;
  }
};

/**
 * ✅ Copy Product to Merchant Store (AWS Lambda Version)
 */
export const copyProductToMerchantStore = async (product: any, shopDomain: string, accessToken: string) => {
  try {
    console.info(`[INFO] [PRODUCT SYNC]: Copying product to ${shopDomain}...`);

    if (!product.title || !product.variants || !Array.isArray(product.variants.edges)) {
      throw new Error("Invalid product input");
    }

    const mutation = `
      mutation CopyProduct($input: ProductInput!) {
        productCreate(input: $input) {
          product {
            id
            title
          }
        }
      }
    `;

    const variables = {
      input: {
        title: product.title,
        bodyHtml: product.bodyHtml,
        vendor: product.vendor,
        productType: product.productType,
        variants: product.variants,
        images: product.images,
      },
    };

    const response = await graphqlRequest(mutation, shopDomain, accessToken, variables);
    return { success: true, data: response };
  } catch (error) {
    console.error("[ERROR] [PRODUCT SYNC ERROR]: Failed to copy product", error);
    return { success: false, error };
  }
};

/**
 * ✅ AWS Lambda Handler - Routes API requests
 */
export const handler = async (event: any) => {
  console.info("[INFO] Incoming Event:", JSON.stringify(event, null, 2));

  const requestId = event.requestContext?.requestId;
  if (requestId) {
    console.info(`[INFO] [REQUEST ID: ${requestId}]`);
  }

  const { path, httpMethod, queryStringParameters, body } = event;
  let response;

  try {
    if (path.includes("fetch-product") && httpMethod === "GET") {
      const { productId } = queryStringParameters || {};
      if (!productId) throw new Error("Missing productId parameter");

      response = await fetchProductFromOrgStore(productId);
    } else if (path.includes("copy-product") && httpMethod === "POST") {
      const { product, shopDomain, accessToken } = JSON.parse(body);
      if (!product || !shopDomain || !accessToken) throw new Error("Missing required parameters");

      response = await copyProductToMerchantStore(product, shopDomain, accessToken);
    } else {
      response = { error: "Invalid Route" };
    }

    return {
      statusCode: response?.error || !response ? 400 : 200,
      body: JSON.stringify(response),
    };
  } catch (error) {
    console.error("[ERROR] Handler failure:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal Server Error" }),
    };
  }
};```

## `app/lambda/lambda.handler.ts`
```
// Auth
export { handler as authHandler } from "./lambda-shopify-auth";
export { handler as authRouterHandler } from "../auth-service/lambda/lambda-auth-router";

// Merchant Management
export { handler as checkOrgCustomerHandler } from "./lambda-check-org-customer";
export { handler as checkMerchantHandler } from "./lambda-check-merchant";
export { handler as createOrgCustomerHandler } from "./lambda-create-org-customer";

// Shopify Integration
export { handler as postInstallHandler } from "./lambda-post-install";
export { handler as proxyHandler } from "./lambda-proxy";
export { handler as productHandler } from "./lambda-shopify-product";
export { handler as graphqlHandler } from "./lambda-shopify-graphql";

// Webhooks
export { handler as webhookHandler } from "./webhook/webhook-handler";
export { handleProductWebhook as webhookProductHandler } from "./webhook/webhook-product";```

## `app/lambda/remixHandler.ts`
```
import cors from 'cors';
import helmet from 'helmet';
import serverlessExpress from '@vendia/serverless-express';
import express from 'express';
import { createRequestHandler } from '@remix-run/express';

const app = express();

const MODE = process.env.NODE_ENV || 'production';

app.use(cors({ origin: true, credentials: true }));
app.use(helmet());

app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

app.all('*', (req, res, next) => {
  const build = require('../../build/server/index.js');
  return createRequestHandler({ build, mode: MODE })(req, res, next);
});

export const handler = serverlessExpress({ app });```

## `app/lambda/services/merchant.service.ts`
```
import { getPrisma } from "../utils/db.server";
import type { Shop } from "@prisma/client";

export async function findMerchantByDomain(shopDomain: string): Promise<Shop | null> {
  const prisma = await getPrisma();
  return prisma.shop.findUnique({ where: { shopDomain } });
}

export async function isMerchantRegistered(shopDomain: string): Promise<boolean> {
  const merchant = await findMerchantByDomain(shopDomain);
  return !!merchant;
}

export async function findOrThrowMerchantByDomain(shopDomain: string): Promise<Shop> {
  const merchant = await findMerchantByDomain(shopDomain);
  if (!merchant) {
    throw new Error(`Merchant not found for domain: ${shopDomain}`);
  }
  return merchant;
}
```

## `app/lambda/services/shopify-org.service.ts`
```
import {
  graphqlRequest,
  CHECK_CUSTOMER_QUERY,
  CREATE_CUSTOMER_MUTATION,
} from "../lambda-shopify-graphql";

export async function checkCustomerExists(email: string, orgUrl: string, token: string): Promise<boolean> {
  const checkRes = await graphqlRequest(
    CHECK_CUSTOMER_QUERY,
    orgUrl,
    token,
    { email }
  );

  console.info("[Org Sync] Checked customer existence", {
    email,
    orgUrl,
    found: checkRes.data?.data?.customers?.edges?.length > 0,
  });

  return checkRes.success &&
    checkRes.data?.data?.customers?.edges?.length > 0;
}

export async function createCustomerInOrg(
  email: string,
  shopName: string,
  orgUrl: string,
  token: string
): Promise<void> {
  const createRes = await graphqlRequest(
    CREATE_CUSTOMER_MUTATION,
    orgUrl,
    token,
    {
      input: {
        email,
        firstName: shopName,
      },
    }
  );

  const userErrors = createRes.data?.data?.customerCreate?.userErrors;
  if (userErrors && userErrors.length > 0) {
    throw new Error(userErrors.map((e: any) => e.message).join(", "));
  }

  if (!createRes.success || !createRes.data?.data?.customerCreate?.customer) {
    throw new Error("Failed to create customer");
  }
  
  console.info("[Org Sync] Created customer in DropX org", {
    email,
    shopName,
    orgUrl,
  });
}
```

## `app/lambda/services/syncTrigger.service.ts`
```
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";

export async function triggerMerchantSync(shop: string, email: string, shopName: string, force = false) {
  const lambda = new LambdaClient({ region: "us-east-1" });

  const payload = JSON.stringify({ shopDomain: shop, email, shopName, force });

  const command = new InvokeCommand({
    FunctionName: "dropx-lambdas-dev-merchantHandler",
    InvocationType: "RequestResponse",
    Payload: Buffer.from(payload),
  });

  try {
    const response = await lambda.send(command);
    if (!response.Payload) {
      throw new Error("No payload returned from Lambda");
    }
    const body = JSON.parse(Buffer.from(response.Payload).toString());
    console.info("[Merchant Sync] Lambda payload:", body);
    const needsRegistration = body?.needsRegistration || false;
 
    return {
      ok: true,
      message: `✅ Your store <b>${shop}</b> is successfully linked to DropX!`,
      needsRegistration
    };
  } catch (error) {
    console.error("Lambda invoke failed:", error);
    return {
      ok: false,
      message: `❌ Sync failed: ${(error as Error).message || "Unknown error"}`,
    };
  }
}```

## `app/lambda/utils/db.server.ts`
```
import { PrismaClient } from "@prisma/client";
import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";

let prisma: PrismaClient | undefined;

async function getDatabaseUrl(): Promise<string> {
  const ssm = new SSMClient({});
  const command = new GetParameterCommand({
    Name: "/dropx/dev/DROPX_DATABASE_URL",
    WithDecryption: true,
  });

  try {
    const result = await ssm.send(command);
    const dbUrl = result.Parameter?.Value;
    if (!dbUrl) {
      throw new Error("DROPX_DATABASE_URL not found in SSM");
    }
    return dbUrl;
  } catch (error) {
    console.error("Failed to fetch database URL from SSM:", error);
    throw new Error("Database configuration error");
  }
}

export async function getPrisma(): Promise<PrismaClient> {
  if (prisma) return prisma;

  const url = await getDatabaseUrl();
  prisma = new PrismaClient({
    datasources: {
      db: {
        url,
      },
    },
  });

  return prisma;
}```

## `app/lambda/utils/fetchShopDetails.ts`
```


import { fetchShopInfo } from "./fetchShopInfo";

export async function fetchShopDetails(shop: string, accessToken: string) {
  const shopData = await fetchShopInfo(shop, accessToken);
  if (!shopData) throw new Error("Invalid shop data received");
  return shopData;
}```

## `app/lambda/utils/fetchShopInfo.ts`
```
export async function fetchShopInfo(shop: string, accessToken: string): Promise<any> {
  const shopInfoRes = await fetch(`https://${shop}/admin/api/2024-10/shop.json`, {
    headers: {
      "X-Shopify-Access-Token": accessToken,
      "Content-Type": "application/json",
    },
  });

  try {
    if (!shopInfoRes.ok) {
      console.error(`Failed to fetch shop info: ${shopInfoRes.status} ${shopInfoRes.statusText}`);
      return null;
    }
    const data = await shopInfoRes.json();
    return data.shop || null;
  } catch (error) {
    console.error("Error parsing shop info response:", error);
    return null;
  }
}
```

## `app/lambda/utils/handleMerchantRouting.ts`
```
export function decideNextStep(
  shop: string,
  email: string,
  shopName?: string,
  needsRegistration = false
) {
  const query = new URLSearchParams({ shop, email });
  if (shopName) query.append("shopName", shopName);

  return {
    statusCode: 302,
    headers: {
      Location: needsRegistration
        ? `/register-redirect?${query.toString()}`
        : `/app-installed?shop=${shop}&email=${email}`,
    },
    body: "",
  };
}
```

## `app/lambda/utils/orgAuth.ts`
```
import { getShopByDomain } from "../../db/shop.db";

export const authenticateOrgShopify = async (shopDomain: string) => {
  if (!shopDomain) {
    console.warn("[WARN] [org-auth] Missing shop domain");
    throw new Error("Missing shop domain");
  }

  const shop = await getShopByDomain(shopDomain);
  if (!shop) {
    console.warn(`[WARN] [org-auth] Shop not found for domain: ${shopDomain}`);
    throw new Error("Shop not found in DropX organization");
  }

  return shop;
};
```

## `app/lambda/utils/processShopInstall.ts`
```
import { upsertShop } from "../../db/shop.db";
import { addSessionToDB } from "../../db/session.db";
import { logActivity } from "../../db/activityLog.db";

export async function processShopInstall(shop: string, accessToken: string, shopData: any) {
  const email = shopData.email || "";
  const name = shopData.name || "";
  const plan = shopData.plan_display_name || "";
  const primaryDomain = shopData.primary_domain?.host || "";
  const currencyCode = shopData.currency || "";
  const timezone = shopData.iana_timezone || "";
  const isCheckoutSupported = shopData.checkout_api_supported || false;

  await upsertShop({
    shopDomain: shop,
    email,
    name,
    plan,
    primaryDomain,
    currencyCode,
    timezone,
    isCheckoutSupported,
    accessToken,
  });

  await addSessionToDB({
    shopDomain: shop,
    accessToken,
    email,
    state: "",
    scope: "read_analytics,write_checkouts,write_companies,write_customers,write_discounts,write_draft_orders,write_fulfillments,write_inventory,write_locales,write_locations,write_marketing_events,write_metaobjects,write_orders,write_payment_terms,write_price_rules,write_products,write_reports,write_resource_feedbacks,write_script_tags,write_shipping,write_themes,read_shop",
    isOnline: false,
    expires: null,
  });

  await logActivity(shop, "App Installed via OAuth");

  return { email, name };
}
```

## `app/lambda/utils/queryString.ts`
```
type QueryParamsResult =
  | { shop: string; email: string; shopName: string; state: string }
  | { error: string };

export function extractQueryParams(
  query: Record<string, string | undefined>
): QueryParamsResult {
  const { shop, email, shopName, state } = query || {};
  const missing = [];
  if (!shop) missing.push("shop");
  if (!email) missing.push("email");
  if (!shopName) missing.push("shopName");
  if (!state) missing.push("state");

  if (missing.length > 0) {
    return { error: `Missing required parameters: ${missing.join(", ")}` };
  }

  return {
    shop: shop as string,
    email: email as string,
    shopName: shopName as string,
    state: state as string,
  };
}```

## `app/lambda/utils/upsertSopInDB.ts`
```


import { processShopInstall } from "./processShopInstall";

export async function upsertShopInDb(shop: string, accessToken: string, shopData: any) {
  return processShopInstall(shop, accessToken, shopData);
}```

## `app/lambda/utils/verifyWebhook.ts`
```
import { createHmac, timingSafeEqual } from "crypto";

/**
 * ✅ Validates the HMAC signature for Shopify webhook security
 */
export function verifyWebhookHMAC(rawBody: string, hmacHeader: string, webhookSecret: string): boolean {
  try {
    const digest = createHmac("sha256", webhookSecret)
      .update(rawBody, "utf8")
      .digest("base64");

    const receivedBuffer = Buffer.from(hmacHeader, "base64");
    const digestBuffer = Buffer.from(digest, "base64");

    if (process.env.NODE_ENV === "development") {
      console.log("[DEBUG] Calculated HMAC:", digest);
      console.log("[DEBUG] Received HMAC:", hmacHeader);
    }

    if (receivedBuffer.length !== digestBuffer.length) return false;
    return timingSafeEqual(receivedBuffer, digestBuffer);
  } catch (error) {
    console.error("[ERROR] [VERIFY HMAC ERROR]:", error);
    return false;
  }
}```

## `app/lambda/webhook/webhook-handler.ts`
```
import { handleProductWebhook } from "./webhook-product";

export const handler = async (event: any) => {
  console.log("[INFO] [WEBHOOK]: Handling Shopify Webhook Event...");
  try {
    return await handleProductWebhook(event);
  } catch (error) {
    console.error("[ERROR] [WEBHOOK]: Failed to handle webhook", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Internal Server Error" }),
    };
  }
};```

## `app/lambda/webhook/webhook-product.ts`
```
import { verifyWebhookHMAC } from "../utils/verifyWebhook";
import { getDropxConfig } from "../../db/config";
// TODO: Replace with real merchant service when available
async function fetchMerchantByEmail(email: string): Promise<boolean> {
  console.warn(`[WEBHOOK][WARN]: [PLACEHOLDER] fetchMerchantByEmail called for ${email}`);
  return true; // Simulated existence
}

async function registerMerchant(email: string): Promise<boolean> {
  console.warn(`[WEBHOOK][WARN]: [PLACEHOLDER] registerMerchant called for ${email}`);
  return true; // Simulated registration
}
// Placeholder: getShopByEmail implementation will be replaced when the module is available.
async function getShopByEmail(email: string): Promise<{ shopDomain: string; accessToken: string } | null> {
  // TODO: Replace this with actual implementation from lambda-shopify-shop
  console.warn("[WEBHOOK][WARN]: [WARNING]: getShopByEmail is using a placeholder implementation.");
  return null;
}
import { copyProductToMerchantStore } from "../lambda-shopify-product";

export async function handleProductWebhook(event: any) {
  try {
    const hmacHeader = event.headers["X-Shopify-Hmac-SHA256"];
    if (!hmacHeader) {
      console.error("[WEBHOOK][ERROR]: [WEBHOOK ERROR]: Missing HMAC header.");
      return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized request." }) };
    }

    const { SHOPIFY_WEBHOOK_SECRET } = await getDropxConfig();
    if (!SHOPIFY_WEBHOOK_SECRET) {
      console.error("[WEBHOOK][ERROR]: [WEBHOOK ERROR]: Missing SHOPIFY_WEBHOOK_SECRET from config.");
      return { statusCode: 500, body: JSON.stringify({ error: "Webhook secret not configured." }) };
    }

    const isValidHmac = verifyWebhookHMAC(event.body, hmacHeader, SHOPIFY_WEBHOOK_SECRET);
    if (!isValidHmac) {
      console.error("[WEBHOOK][ERROR]: [WEBHOOK ERROR]: HMAC verification failed.");
      return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized request." }) };
    }

    const body = JSON.parse(event.body);
    const { email, product } = body;

    if (!email || !product) {
      console.error("[WEBHOOK][ERROR]: [WEBHOOK ERROR]: Missing required parameters.");
      return { statusCode: 400, body: JSON.stringify({ error: "Missing required parameters." }) };
    }

    console.info(`[WEBHOOK][INFO]: [WEBHOOK]: Received product add event for email: ${email}`);

    let merchantExists = await fetchMerchantByEmail(email);
    if (!merchantExists) {
      console.info(`[WEBHOOK][INFO]: [WEBHOOK]: Merchant email (${email}) not found. Creating...`);
      const created = await registerMerchant(email);

      if (!created) {
        console.error("[WEBHOOK][ERROR]: [WEBHOOK ERROR]: Failed to create merchant");
        return { statusCode: 500, body: JSON.stringify({ error: "Failed to register merchant" }) };
      }
    }

    console.info("[WEBHOOK][INFO]: [WEBHOOK]: Merchant verified. Fetching shop details...");
    const shopData = await getShopByEmail(email);

    if (!shopData || !shopData.accessToken) {
      console.error(`[WEBHOOK][ERROR]: [WEBHOOK ERROR]: No access token found for ${email}'s store`);
      return { statusCode: 403, body: JSON.stringify({ error: "Merchant shop not authenticated." }) };
    }

    console.info("[WEBHOOK][INFO]: [WEBHOOK]: Merchant shop access token retrieved, syncing product...");
    const syncResult = await copyProductToMerchantStore(product, shopData.shopDomain, shopData.accessToken);

    if (!syncResult.success) {
      console.error("[WEBHOOK][ERROR]: [WEBHOOK ERROR]: Failed to sync product", syncResult.error);
      return { statusCode: 500, body: JSON.stringify({ error: "Failed to sync product" }) };
    }

    console.info(`[WEBHOOK][INFO]: [WEBHOOK]: Successfully synced product ${product.id} to ${shopData.shopDomain}`);
    return { statusCode: 200, body: JSON.stringify({ success: "Product synced successfully." }) };
  } catch (error) {
    console.error("[WEBHOOK][ERROR]: [WEBHOOK ERROR]:", error);
    return { statusCode: 500, body: JSON.stringify({ error: "Internal server error." }) };
  }
}```

## `app/root.tsx`
```
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useRouteError,
} from "@remix-run/react";
import type { MetaFunction, HeadersFunction } from "@remix-run/node";

// Metadata for the app
export const meta: MetaFunction = () => [
  { charset: "utf-8" },
  { title: "DropX" },
  { name: "viewport", content: "width=device-width,initial-scale=1" },
];

// Headers function to include loader and parent headers
export const headers: HeadersFunction = ({ loaderHeaders, parentHeaders }) => ({
  "Content-Type": "text/html",
  ...Object.fromEntries(loaderHeaders),
  ...Object.fromEntries(parentHeaders),
});

// Root application component
export default function App() {
  console.log("[ROOT]: Rendering main application...");

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <link rel="preconnect" href="https://cdn.shopify.com/" />
        <link
          rel="stylesheet"
          href="https://cdn.shopify.com/static/fonts/inter/v4/styles.css"
        />
        <Meta />
        <Links />
      </head>
      <body>
        <main>
          <Outlet />
        </main>
        <footer>
          <p>© {new Date().getFullYear()} DropX. All rights reserved.</p>
        </footer>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

// Global Error Boundary
export function ErrorBoundary({ error }: { error: unknown }) {
  console.error("[ERROR BOUNDARY]: Global error caught:", error);

  const errorMessage =
    error && typeof error === "object" && "message" in error
      ? String((error as Error).message)
      : "An unexpected error occurred.";

  const errorStack =
    process.env.NODE_ENV === "development" && error && typeof error === "object" && "stack" in error
      ? String((error as Error).stack)
      : "No stack trace available.";

  return (
    <html lang="en">
      <head>
        <title>Error</title>
        <Meta />
        <Links />
      </head>
      <body>
        <h1>Application Error</h1>
        <p>{errorMessage}</p>
        {process.env.NODE_ENV === "development" && (
          <pre style={{ whiteSpace: "pre-wrap", color: "red" }}>{errorStack}</pre>
        )}
        <Scripts />
      </body>
    </html>
  );
}

// Catch Boundary for Specific HTTP Errors
export function CatchBoundary() {
  const error = useRouteError();
  console.error("[CATCH BOUNDARY]: Error caught by CatchBoundary:", error);

  const errorMessage =
    error && typeof error === "object" && "message" in error
      ? String((error as Error).message)
      : "An unexpected error occurred. Please try again later.";

  const errorName =
    error && typeof error === "object" && "name" in error
      ? String((error as Error).name)
      : "Error";

  const statusCode =
    error && typeof error === "object" && "status" in error
      ? String((error as { status?: number }).status)
      : "Unknown";

  return (
    <html lang="en">
      <head>
        <title>{errorName}</title>
        <Meta />
        <Links />
      </head>
      <body>
        <h1>{errorName}</h1>
        <p>Status Code: {statusCode}</p>
        <p>{errorMessage}</p>
        <Scripts />
      </body>
    </html>
  );
}```

## `app/routes.ts`
```
import { flatRoutes } from "@remix-run/fs-routes";

// Generate routes automatically from the app/routes directory
export default flatRoutes();```

## `app/routes/app-installed.tsx`
```
import { useEffect } from "react";
import { useSearchParams } from "@remix-run/react";

export default function AppInstalled() {
  const [searchParams] = useSearchParams();
  const shop = searchParams.get("shop") || "";
  const shopName = searchParams.get("shopName") || "";

  useEffect(() => {
    console.log("AppInstalled page loaded");
  }, []);

  return (
    <div style={{ padding: "3rem", textAlign: "center", fontFamily: "sans-serif" }}>
      <h1>🎉 You're Already Connected!</h1>
      {shop ? (
        <p style={{ marginTop: "1rem", fontSize: "1.2rem" }}>
          Your store <strong>{shop}</strong>
          {shopName && ` (${shopName})`} is already linked to DropX.
        </p>
      ) : (
        <p style={{ marginTop: "1rem", fontSize: "1.2rem" }}>
          Store information is not available.
        </p>
      )}
      <p>You can now start managing your synced products and orders.</p>
      <a
        href="https://drop-x.co/account/login"
        aria-label="Go to DropX Dashboard"
        style={{
          marginTop: "2rem",
          display: "inline-block",
          padding: "0.75rem 1.5rem",
          fontSize: "1rem",
          backgroundColor: "#111827",
          color: "#fff",
          borderRadius: "6px",
          textDecoration: "none",
        }}
      >
        Go to DropX Dashboard
      </a>
    </div>
  );
}
```

## `app/routes/dashboard.tsx`
```
import { useEffect, useState } from "react";
import { data, type LoaderFunction } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import type { MetaFunction } from "@remix-run/node";

export const meta: MetaFunction = () => {
  return [{ title: "DropX Dashboard" }];
};

type Product = {
  id: string;
  title: string;
  status: string;
  synced: boolean;
};

export const loader: LoaderFunction = async () => {
  // Placeholder: replace with call to your backend or GraphQL endpoint
  const products: Product[] = [
    { id: "1", title: "Red Hoodie", status: "Active", synced: true },
    { id: "2", title: "Blue Sneakers", status: "Inactive", synced: false },
  ];

  return data({ products });
};

export default function Dashboard() {
  useEffect(() => {
    console.info("[INFO] Dashboard page loaded.");
  }, []);

  const { products } = useLoaderData<typeof loader>();

  return (
    <div style={{ padding: "2rem" }}>
      <h1>📦 DropX Product Dashboard</h1>
      <p>Manage your synced products below.</p>
      {products.length === 0 ? (
        <p>No products found. Start by syncing your first product!</p>
      ) : (
        <table aria-label="Product list" style={{ width: "100%", marginTop: "1rem", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ borderBottom: "1px solid #ccc", padding: "0.5rem" }}>Product</th>
              <th style={{ borderBottom: "1px solid #ccc", padding: "0.5rem" }}>Status</th>
              <th style={{ borderBottom: "1px solid #ccc", padding: "0.5rem" }}>Synced</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product: Product) => (
              <tr key={product.id}>
                <td style={{ padding: "0.5rem" }}>{product.title}</td>
                <td style={{ padding: "0.5rem" }}>
                  <span style={{ color: product.status === "Active" ? "green" : "gray" }}>
                    {product.status}
                  </span>
                </td>
                <td style={{ padding: "0.5rem" }}>
                  {product.synced ? "✅" : "❌"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}


export function ErrorBoundary({ error }: { error: Error }) {
  console.error("[ERROR] Dashboard loader failed:", error);
  return (
    <div style={{ padding: "2rem", color: "red" }}>
      <h2>⚠️ Something went wrong</h2>
      <p>{error.message}</p>
    </div>
  );
}```

## `app/routes/error.tsx`
```
import { useSearchParams } from "@remix-run/react";

export default function ErrorPage() {
  const [searchParams] = useSearchParams();
  const message = searchParams.get("message") || "An unexpected error occurred.";
  const shop = searchParams.get("shop");
  const code = searchParams.get("code");

  return (
    <main style={{ textAlign: "center", marginTop: "50px", fontFamily: "Arial, sans-serif" }}>
      <h1>⚠️ Oops! Something went wrong with DropX</h1>
      <p>{message}</p>
      {shop && <p><strong>Shop:</strong> {shop}</p>}
      {code && <p><strong>Error Code:</strong> {code}</p>}
      <p>If the problem persists, please contact our support or try again later.</p>
      <a
        href="/"
        style={{
          display: "inline-block",
          marginTop: "20px",
          padding: "10px 20px",
          backgroundColor: "#2563EB",
          color: "#fff",
          borderRadius: "4px",
          textDecoration: "none",
          fontWeight: "bold"
        }}
      >
        Back to DropX Home
      </a>
    </main>
  );
}```

## `app/routes/loading.tsx`
```
import { MetaFunction } from "@remix-run/node";

export const meta: MetaFunction = () => {
  return [{ title: "DropX | Loading" }];
};

export default function Loading() {
  return (
    <main style={{ padding: "3rem", textAlign: "center", fontFamily: "sans-serif" }}>
      <h2>⏳ Just a moment...</h2>
      <p>We're preparing your store, syncing data, or redirecting you.</p>
      <p>Please do not close this tab.</p>
    </main>
  );
}```

## `app/routes/post-install.tsx`
```
import { useEffect, useState } from "react";
import { useSearchParams } from "@remix-run/react";

export default function PostInstall() {
  const [params] = useSearchParams();
  const shop = params.get("shop") || "";
  const shopName = params.get("shopName") || "";
  const email = params.get("email") || "";

  const [status, setStatus] = useState<"checking" | "linked" | "not_found">("checking");

  useEffect(() => {
    const isValidEmail = email.includes("@");
    const isValidShop = shop.endsWith(".myshopify.com");

    if (isValidEmail && isValidShop) {
      console.info("[PostInstall] Checking store:", { shop, email });
      fetch("https://api.drop-x.co/post-install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shop, email }),
      })
        .then((res) => {
          if (res.status === 200) {
            setStatus("linked");
          } else {
            setStatus("not_found");
          }
        })
        .catch((error) => {
          console.error("[PostInstall] API call failed", error);
          setStatus("not_found");
        });
    } else {
      console.warn("[PostInstall] Invalid shop or email", { shop, email });
      setStatus("not_found");
    }
  }, [shop, email]);

  return (
    <main>
      <div style={{ fontFamily: "sans-serif", padding: "3rem", textAlign: "center" }}>
        <h1>🎉 Welcome to DropX!</h1>
        {status === "checking" && <p>Checking store status...</p>}

        {status === "linked" && (
          <>
            <p style={{ fontSize: "1.2rem", marginTop: "1rem" }}>
              ✅ Your store <strong>{shop}</strong>{shopName && ` (${shopName})`} is now successfully linked to DropX.
            </p>
            <p style={{ marginTop: "2rem" }}>You're all set to start syncing products and orders.</p>
            <a
              href="https://drop-x.co/account/login"
              style={{
                marginTop: "2rem",
                display: "inline-block",
                padding: "0.75rem 1.5rem",
                fontSize: "1rem",
                backgroundColor: "#111827",
                color: "#fff",
                borderRadius: "6px",
                textDecoration: "none",
              }}
            >
              Go to DropX Dashboard
            </a>
          </>
        )}

        {status === "not_found" && (
          <>
            <p style={{ fontSize: "1.2rem", marginTop: "1rem", color: "red" }}>
              🚫 We couldn't find your store in DropX.
            </p>
            <p>Please register to complete your setup.</p>
            <a
              href={`https://drop-x.co/account/register?email=${email}&shop=${shop}`}
              style={{
                marginTop: "2rem",
                display: "inline-block",
                padding: "0.75rem 1.5rem",
                fontSize: "1rem",
                backgroundColor: "#c53030",
                color: "#fff",
                borderRadius: "6px",
                textDecoration: "none",
              }}
            >
              Register Your Store
            </a>
          </>
        )}
      </div>
    </main>
  );
}```

## `app/routes/register-redirect.tsx`
```
import { useSearchParams } from "@remix-run/react";
import { useEffect, useState } from "react";

export default function RegisterRedirect() {
  const [searchParams] = useSearchParams();
  const email = searchParams.get("email") || "";
  const shop = searchParams.get("shop") || "";
  const shopName = searchParams.get("shopName") || "";

  const [registrationComplete, setRegistrationComplete] = useState(false);
  const [checking, setChecking] = useState(false);

  const handleContinue = async () => {
    try {
      setChecking(true);
      const postInstallEndpoint = "https://app.drop-x.co/post-install"; // using SSM param value here
      const res = await fetch(postInstallEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ shop, email }),
      });

      const result = await res.json();

      if (result?.needsRegistration) {
        setChecking(false);
        alert("Registration still required. Please complete the registration before continuing.");
      } else {
        setRegistrationComplete(true);
        window.location.href = `/post-install?email=${encodeURIComponent(email)}&shop=${encodeURIComponent(shop)}&shopName=${encodeURIComponent(shopName)}`;
      }
    } catch (error) {
      console.error("[ERROR] Sync check failed:", error);
      alert("An error occurred while verifying registration. Please try again.");
    }
  };

  return (
    <div style={{ padding: "2rem", textAlign: "center", fontFamily: "sans-serif" }}>
      {!registrationComplete ? (
        <>
          <h1>🔐 Registration Required</h1>
          <p>To sync your store <strong>{shopName || shop}</strong> with DropX, you must first create an account.</p>
          <a
            href="https://drop-x.co/account/register"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-block",
              margin: "1rem 0",
              padding: "0.75rem 1.5rem",
              backgroundColor: "#000",
              color: "#fff",
              textDecoration: "none",
              borderRadius: "5px"
            }}
          >
            Register on DropX
          </a>
          <p>Once you're done, click the button below to continue.</p>
          {checking ? (
            <p>🔄 Verifying your registration...</p>
          ) : (
            <button
              onClick={handleContinue}
              style={{
                marginTop: "1rem",
                padding: "0.75rem 1.5rem",
                fontSize: "1rem",
                borderRadius: "5px",
                border: "none",
                backgroundColor: "#0070f3",
                color: "#fff",
                cursor: "pointer"
              }}
            >
              ✅ I've Registered, Continue
            </button>
          )}
        </>
      ) : (
        <h2>✅ You're already synced with DropX!</h2>
      )}
    </div>
  );
}
```

## `app/routes/register-success.tsx`
```
import { useSearchParams } from "@remix-run/react";

export default function RegisterSuccess() {
  const [searchParams] = useSearchParams();
  const email = searchParams.get("email") || "";
  const shop = searchParams.get("shop") || "";
  const shopName = searchParams.get("shopName") || "";

  const postInstallUrl = new URL("/post-install", process.env.DROPX_APPLICATION_URL);
  postInstallUrl.searchParams.set("email", email);
  postInstallUrl.searchParams.set("shop", shop);
  postInstallUrl.searchParams.set("shopName", shopName);

  return (
    <div style={{ padding: "3rem", textAlign: "center", fontFamily: "sans-serif" }}>
      <h1>🎉 Registration Successful!</h1>
      <p style={{ marginTop: "1rem", fontSize: "1.2rem" }}>
        Your store <strong>{shop}</strong>{shopName && ` (${shopName})`} has been registered.
      </p>
      <p>You're now ready to link it to DropX and begin syncing products.</p>
      <a
        href={postInstallUrl.toString()}
        style={{
          marginTop: "2rem",
          display: "inline-block",
          padding: "0.75rem 1.5rem",
          fontSize: "1rem",
          backgroundColor: "#111827",
          color: "#fff",
          borderRadius: "6px",
          textDecoration: "none",
        }}
      >
        Continue to Sync
      </a>
    </div>
  );
}
```

## `app/routes/sync-status.tsx`
```
import { LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { getSSMParam } from "../utils/getSSMParam";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");

  if (!shop) {
    throw new Response("Missing shop parameter", { status: 400 });
  }

  const apiBaseUrl = await getSSMParam("/dropx/dev/DROPX_API_BASE_URL");

  const response = await fetch(`${apiBaseUrl}/check-org-customer`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ shopDomain: shop }),
  });

  const result = await response.json();

  return Response.json({
    shop,
    status: result?.needsRegistration ? "❌ Not Found in Org Store" : "✅ Synced",
  });
}

export default function SyncStatusPage() {
  const { shop, status } = useLoaderData<typeof loader>();

  return (
    <div style={{ padding: 20 }}>
      <h1>Sync Status</h1>
      <p><strong>Shop:</strong> {shop}</p>
      <p><strong>Status:</strong> {status}</p>
      <p>This page is useful for internal QA and debugging purposes.</p>
    </div>
  );
}```

## `app/server.lambda.ts`
```
import { createRequestHandler } from "@remix-run/express";
import express from "express";
import compression from "compression";
import morgan from "morgan";

const app = express();

app.use(compression());
app.use(morgan("tiny"));

app.all(
  "*",
  createRequestHandler({
    build: require("../build/server/index.js"),
    mode: process.env.NODE_ENV,
  })
);

export default app;```

## `app/types/lru-cache.d.ts`
```
declare module 'lru-cache' {
    import { LRUCache } from "lru-cache";
    export default LRUCache;
  }```

## `app/utils/env.ts`
```
// File: app/utils/env.ts

export function getEnvVar(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`🚨 Missing required environment variable: ${key}`);
  }
  return value;
}

// ✅ DropX Shopify App Credentials
export const DROPX_SHOPIFY_API_KEY = getEnvVar("DROPX_SHOPIFY_API_KEY");
export const DROPX_SHOPIFY_API_SECRET = getEnvVar("DROPX_SHOPIFY_API_SECRET");
export const DROPX_APPLICATION_URL = getEnvVar("DROPX_APPLICATION_URL");
export const DROPX_DATABASE_URL = getEnvVar("DROPX_DATABASE_URL");

// ✅ Organization’s Shopify Store Credentials
export const ORG_SHOPIFY_STORE_URL = getEnvVar("ORG_SHOPIFY_STORE_URL");
export const ORG_SHOPIFY_API_KEY = getEnvVar("ORG_SHOPIFY_API_KEY");
export const ORG_SHOPIFY_API_SECRET = getEnvVar("ORG_SHOPIFY_API_SECRET");
export const ORG_SHOPIFY_ADMIN_API_TOKEN = getEnvVar("ORG_SHOPIFY_ADMIN_API_TOKEN");

// ✅ Organization’s Shopify Storefront Credentials
export const ORG_SHOPIFY_STOREFRONT_TOKEN = getEnvVar("ORG_SHOPIFY_STOREFRONT_TOKEN");
export const ORG_SHOPIFY_APP_PROXY_SUBPATH = getEnvVar("ORG_SHOPIFY_APP_PROXY_SUBPATH");
export const ORG_SHOPIFY_APP_PROXY_BASE_URL = getEnvVar("ORG_SHOPIFY_APP_PROXY_BASE_URL");

// ✅ App Proxy Configuration
export const SHOPIFY_APP_PROXY_SUBPATH = getEnvVar("SHOPIFY_APP_PROXY_SUBPATH");
export const SHOPIFY_APP_PROXY_BASE_URL = getEnvVar("SHOPIFY_APP_PROXY_BASE_URL");

// ✅ Shopify API Version (for keeping API calls consistent)
export const SHOPIFY_API_VERSION = getEnvVar("SHOPIFY_API_VERSION");

// ✅ Shopify Webhook Secret (for verifying HMAC signatures)
export const SHOPIFY_WEBHOOK_SECRET = getEnvVar("SHOPIFY_WEBHOOK_SECRET");

// ✅ Shopify Scopes (for OAuth permission settings)
export const SHOPIFY_SCOPES = getEnvVar("SHOPIFY_SCOPES");

// ✅ DropX Database Credentials
export const DROPX_DB_NAME = getEnvVar("DROPX_DB_NAME");
export const DROPX_DB_USER = getEnvVar("DROPX_DB_USER");
export const DROPX_DB_PASSWORD = getEnvVar("DROPX_DB_PASSWORD");

// ✅ Shopify GraphQL API Endpoint (for organization store)
export const ORG_SHOPIFY_GRAPHQL_ENDPOINT = `https://${ORG_SHOPIFY_STORE_URL}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`;

// ✅ Prisma Database Shadow URL (Fix for Heroku migration issues)
export const SHADOW_DATABASE_URL = getEnvVar("SHADOW_DATABASE_URL");

// ✅ Validate Required Variables Exist
const REQUIRED_ENV_VARS = [
"DROPX_SHOPIFY_API_KEY",
"DROPX_SHOPIFY_API_SECRET",
"DROPX_APPLICATION_URL",
"DROPX_DATABASE_URL",
"ORG_SHOPIFY_STORE_URL",
"ORG_SHOPIFY_API_KEY",
"ORG_SHOPIFY_API_SECRET",
"ORG_SHOPIFY_ADMIN_API_TOKEN",
"ORG_SHOPIFY_STOREFRONT_TOKEN",
"ORG_SHOPIFY_APP_PROXY_SUBPATH",
"ORG_SHOPIFY_APP_PROXY_BASE_URL",
"SHOPIFY_APP_PROXY_BASE_URL",
"SHOPIFY_API_VERSION",
"SHOPIFY_WEBHOOK_SECRET",
"SHOPIFY_SCOPES",
"DROPX_DB_NAME",
"DROPX_DB_USER",
"DROPX_DB_PASSWORD"
];

REQUIRED_ENV_VARS.forEach((key) => getEnvVar(key));```

## `app/utils/getSSMParam.ts`
```
import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";

export async function getSSMParam(key: string): Promise<string | undefined> {
  const ssm = new SSMClient({});
  const command = new GetParameterCommand({
    Name: `/dropx/dev/${key}`,
    WithDecryption: true,
  });

  const response = await ssm.send(command);
  return response.Parameter?.Value;
}```

## `app/utils/logger.ts`
```
import fs from "fs";
import path from "path";
import { format } from "date-fns";

// Log levels
enum LogLevel {
  INFO = "INFO",
  DEBUG = "DEBUG",
  WARN = "WARN",
  ERROR = "ERROR",
}

// Logger utility
class Logger {
  private logFilePath: string;

  constructor() {
    const logDir = path.resolve(process.cwd(), "logs");
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true }); // Ensure the logs directory exists
    }

    const timestamp = format(new Date(), "yyyy-MM-dd");
    this.logFilePath = path.join(logDir, `dropx-${timestamp}.log`);
  }

  private writeLog(level: LogLevel, message: string, meta?: Record<string, any>) {
    const timestamp = format(new Date(), "yyyy-MM-dd HH:mm:ss");
    const logEntry = `[${timestamp}] [${level}] ${message}${
      meta ? ` | Meta: ${JSON.stringify(meta, null, 2)}` : ""
    }\n`;

    // Write log to file
    fs.appendFileSync(this.logFilePath, logEntry);

    // Output to console for immediate feedback
    if (level === LogLevel.ERROR) {
      console.error(logEntry);
    } else if (level === LogLevel.WARN) {
      console.warn(logEntry);
    } else {
      console.log(logEntry);
    }
  }

  info(message: string, meta?: Record<string, any>) {
    this.writeLog(LogLevel.INFO, message, meta);
  }

  debug(message: string, meta?: Record<string, any>) {
    this.writeLog(LogLevel.DEBUG, message, meta);
  }

  warn(message: string, meta?: Record<string, any>) {
    this.writeLog(LogLevel.WARN, message, meta);
  }

  error(message: string, meta?: Record<string, any>) {
    this.writeLog(LogLevel.ERROR, message, meta);
  }

  /**
   * ✅ Track API requests for debugging
   */
  logApiRequest(endpoint: string, method: string, statusCode: number, payload?: any) {
    this.writeLog(LogLevel.INFO, `API Request: ${method} ${endpoint} - Status: ${statusCode}`, { payload });
  }

  /**
   * ✅ Track merchant sync operations
   */
  logMerchantSync(email: string, status: string, meta?: any) {
    this.writeLog(LogLevel.INFO, `Merchant Sync: ${email} - Status: ${status}`, meta);
  }

  /**
   * ✅ Track product sync operations
   */
  logProductSync(productId: string, shopDomain: string, status: string, meta?: any) {
    this.writeLog(LogLevel.INFO, `Product Sync: ${productId} for ${shopDomain} - Status: ${status}`, meta);
  }
}

// Export a singleton instance
const logger = new Logger();

export default logger;```

## `config/config.js`
```
import dotenv from 'dotenv';
dotenv.config();

export default {
  development: {
    use_env_variable: "DROPX_DATABASE_URL",
    dialect: "postgres",
    dialectOptions: process.env.DATABASE_URL.includes("localhost")
      ? {} // No SSL locally
      : {
          ssl: {
            require: true,
            rejectUnauthorized: false, // Required for Heroku
          },
        },
  },
  test: {
    use_env_variable: "DROPX_DATABASE_URL",
    dialect: "postgres",
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false,
      },
    },
  },
  production: {
    use_env_variable: "DROPX_DATABASE_URL",
    dialect: "postgres",
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false,
      },
    },
  },
};```

## `config/server.ts`
```
import serverlessExpress from '@vendia/serverless-express';
import { createRequestHandler } from '@remix-run/express';
import express from 'express';
import compression from 'compression';
import morgan from 'morgan';
import path from 'path';

const MODE = process.env.NODE_ENV;
const BUILD_DIR = path.join(process.cwd(), 'build');

const app = express();

// Basic middleware setup
app.use(compression());
app.use(morgan('tiny'));

// Serve static files from /public
app.use(express.static('public'));

app.all(
  '*',
  createRequestHandler({
    build: require(BUILD_DIR),
    mode: MODE,
  })
);

export const handler = serverlessExpress({ app });```

## `models/index.js`
```
'use strict';

const fs = require('fs');
const path = require('path');
const Sequelize = require('sequelize');
const process = require('process');
const basename = path.basename(__filename);
const env = process.env.NODE_ENV || 'development';
const config = require(__dirname + '/../config/config.json')[env];
const db = {};

let sequelize;
if (config.use_env_variable) {
  sequelize = new Sequelize(process.env[config.use_env_variable], config);
} else {
  sequelize = new Sequelize(config.database, config.username, config.password, config);
}

fs
  .readdirSync(__dirname)
  .filter(file => {
    return (
      file.indexOf('.') !== 0 &&
      file !== basename &&
      file.slice(-3) === '.js' &&
      file.indexOf('.test.js') === -1
    );
  })
  .forEach(file => {
    const model = require(path.join(__dirname, file))(sequelize, Sequelize.DataTypes);
    db[model.name] = model;
  });

Object.keys(db).forEach(modelName => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
```

