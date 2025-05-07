# Code Index for app/auth-service

## app/auth-service/oauth-callback.ts

```ts
import { getSSMParam } from "../utils/getSSMParam";
import { createHash, randomBytes } from "crypto";
import { storeOAuthState, getOAuthState } from "app/auth-service/utils/stateStore";
import { validateCallbackQuery } from "./utils/validateCallbackQuery";
import { verifyOAuthRequest } from "app/auth-service/utils/verifyOAuthRequest";
import { exchangeCodeForToken } from "./utils/exchangeCodeForToken";
import { fetchShopDetails } from "../lambda/utils/fetchShopDetails";
import { upsertShopInDb } from "../lambda/utils/upsertSopInDB";
import { buildRedirectUrl } from "./utils/buildRedirectUrl";
import { redirectWithError } from "app/auth-service/utils/redirectWithError";

const SHOPIFY_APP_SCOPE = "read_analytics,write_checkouts,write_companies,write_customers,write_discounts,write_draft_orders,write_fulfillments,write_inventory,write_locales,write_locations,write_marketing_events,write_metaobjects,write_orders,write_payment_terms,write_price_rules,write_products,write_reports,write_resource_feedbacks,write_script_tags,write_shipping,write_themes,read_shop";

export const authenticateShopify = async (event: any) => {
  try {
    const DROPX_SHOPIFY_API_KEY = await getSSMParam("DROPX_SHOPIFY_API_KEY");
    const DROPX_APPLICATION_URL = await getSSMParam("DROPX_APPLICATION_URL");
    if (!DROPX_SHOPIFY_API_KEY || !DROPX_APPLICATION_URL) {
      throw new Error("Missing required environment variables");
    }

    const { shop, code, state } = event.queryStringParameters || {};

    // Handle callback
    if (code && state) {
      const query = validateCallbackQuery(event.queryStringParameters || {});
      const isValid = await verifyOAuthRequest(query);
      if (!isValid) return redirectWithError("HMAC+verification+failed", DROPX_APPLICATION_URL);

      const storedState = getOAuthState(query.shop);
      if (!storedState || storedState !== query.state) {
        return redirectWithError("Invalid+or+expired+OAuth+state+parameter", DROPX_APPLICATION_URL);
      }

      const accessToken = await exchangeCodeForToken(query.shop, query.code);
      if (!accessToken) return redirectWithError("Missing+access+token", DROPX_APPLICATION_URL);

      const shopData = await fetchShopDetails(query.shop, accessToken);
      const { email, name } = await upsertShopInDb(query.shop, accessToken, shopData);

      const redirectUrl = await buildRedirectUrl(query.shop, email, name);
      return {
        statusCode: 302,
        headers: { Location: redirectUrl },
        body: "",
      };
    }

    // Handle initial install
    if (!shop) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing required shop parameter." }),
      };
    }

    const newState = createHash("sha256").update(randomBytes(16)).digest("hex");
    storeOAuthState(shop, newState);

    const redirectToShopifyOAuth = `https://${shop}/admin/oauth/authorize?client_id=${DROPX_SHOPIFY_API_KEY}&scope=${SHOPIFY_APP_SCOPE}&redirect_uri=${encodeURIComponent(DROPX_APPLICATION_URL + "/shopify/auth")}&state=${newState}`;

    return {
      statusCode: 302,
      headers: { Location: redirectToShopifyOAuth },
      body: "",
    };
  } catch (error: any) {
    console.error("[OAuth Error]", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "OAuth handler failed", message: error.message }),
    };
  }
};
```

## app/auth-service/utils/exchangeCodeForToken.ts

```ts
import { exchangeShopifyToken } from "./exchangeShopifyToken";
import { getSSMParam } from "../../utils/getSSMParam";

export async function exchangeCodeForToken(shop: string, code: string) {
  const apiKey = await getSSMParam("DROPX_SHOPIFY_API_KEY");
  const apiSecret = await getSSMParam("DROPX_SHOPIFY_API_SECRET");
  if (!apiKey || !apiSecret) throw new Error("Missing API credentials");

  return exchangeShopifyToken(shop, code, apiKey, apiSecret);
}
```

## app/auth-service/utils/validateCallbackQuery.ts

```ts


export function validateCallbackQuery(query: Record<string, string | undefined>) {
  const { shop, hmac, code, state } = query;
  if (!shop || !hmac || !code || !state) {
    throw new Error("Missing required OAuth parameters");
  }
  return { shop, hmac, code, state };
}
```

## app/auth-service/utils/validateInstallQuery.ts

```ts
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

## app/auth-service/utils/exchangeShopifyToken.ts

```ts
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

## app/auth-service/utils/buildRedirectUrl.ts

```ts
import { getSSMParam } from "../../utils/getSSMParam";

export async function buildRedirectUrl(shop: string, email: string, name: string) {
  const POST_INSTALL_URL = await getSSMParam("DROPX_POST_INSTALL_REDIRECT");
  if (!POST_INSTALL_URL) throw new Error("Missing post-install URL");

  return `${POST_INSTALL_URL}?shop=${encodeURIComponent(shop)}&email=${encodeURIComponent(email)}&shopName=${encodeURIComponent(name)}`;
}
```

## app/auth-service/utils/verifyOAuthRequest.ts

```ts
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
};
```

## app/auth-service/utils/stateStore.ts

```ts
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
}
```

## app/auth-service/utils/redirectWithError.ts

```ts
export const redirectWithError = (message: string, baseUrl: string) => ({
  statusCode: 302,
  headers: {
    Location: `${baseUrl}/auth/error?message=${encodeURIComponent(message)}`,
  },
  body: "",
});

```

## app/auth-service/oauth-install.ts

```ts
import { getSSMParam } from "../utils/getSSMParam";
import { createHash, randomBytes } from "crypto";
import { storeOAuthState, getOAuthState } from "app/auth-service/utils/stateStore";
import { validateCallbackQuery } from "./utils/validateCallbackQuery";
import { verifyOAuthRequest } from "app/auth-service/utils/verifyOAuthRequest";
import { exchangeCodeForToken } from "./utils/exchangeCodeForToken";
import { fetchShopDetails } from "../lambda/utils/fetchShopDetails";
import { upsertShopInDb } from "../lambda/utils/upsertSopInDB";
import { buildRedirectUrl } from "./utils/buildRedirectUrl";
import { redirectWithError } from "app/auth-service/utils/redirectWithError";

const SHOPIFY_APP_SCOPE = "read_analytics,write_checkouts,write_companies,write_customers,write_discounts,write_draft_orders,write_fulfillments,write_inventory,write_locales,write_locations,write_marketing_events,write_metaobjects,write_orders,write_payment_terms,write_price_rules,write_products,write_reports,write_resource_feedbacks,write_script_tags,write_shipping,write_themes,read_shop";

export const authenticateShopify = async (event: any) => {
  try {
    const DROPX_SHOPIFY_API_KEY = await getSSMParam("DROPX_SHOPIFY_API_KEY");
    const DROPX_APPLICATION_URL = await getSSMParam("DROPX_APPLICATION_URL");
    if (!DROPX_SHOPIFY_API_KEY || !DROPX_APPLICATION_URL) {
      throw new Error("Missing required environment variables");
    }

    const { shop, code, state } = event.queryStringParameters || {};

    // Handle callback
    if (code && state) {
      const query = validateCallbackQuery(event.queryStringParameters || {});
      const isValid = await verifyOAuthRequest(query);
      if (!isValid) return redirectWithError("HMAC+verification+failed", DROPX_APPLICATION_URL);

      const storedState = getOAuthState(query.shop);
      if (!storedState || storedState !== query.state) {
        return redirectWithError("Invalid+or+expired+OAuth+state+parameter", DROPX_APPLICATION_URL);
      }

      const accessToken = await exchangeCodeForToken(query.shop, query.code);
      if (!accessToken) return redirectWithError("Missing+access+token", DROPX_APPLICATION_URL);

      const shopData = await fetchShopDetails(query.shop, accessToken);
      const { email, name } = await upsertShopInDb(query.shop, accessToken, shopData);

      const redirectUrl = await buildRedirectUrl(query.shop, email, name);
      return {
        statusCode: 302,
        headers: { Location: redirectUrl },
        body: "",
      };
    }

    // Handle initial install
    if (!shop) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing required shop parameter." }),
      };
    }

    const newState = createHash("sha256").update(randomBytes(16)).digest("hex");
    storeOAuthState(shop, newState);

    const redirectToShopifyOAuth = `https://${shop}/admin/oauth/authorize?client_id=${DROPX_SHOPIFY_API_KEY}&scope=${SHOPIFY_APP_SCOPE}&redirect_uri=${encodeURIComponent(DROPX_APPLICATION_URL + "/shopify/auth")}&state=${newState}`;

    return {
      statusCode: 302,
      headers: { Location: redirectToShopifyOAuth },
      body: "",
    };
  } catch (error: any) {
    console.error("[OAuth Error]", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "OAuth handler failed", message: error.message }),
    };
  }
};

```

## app/auth-service/lambda/lambda-auth-router.ts

```ts
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { authenticateShopify } from "app/auth-service/oauth-install";

type AuthRouteHandler = (event: APIGatewayProxyEvent) => Promise<APIGatewayProxyResult>;

const routes: Record<string, AuthRouteHandler> = {
  "/shopify/auth": authenticateShopify,
  "/shopify/callback": authenticateShopify,
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

## app/auth-service/routes/welcome.tsx

```tsx


import { useSearchParams } from "@remix-run/react";
import { useEffect, useState } from "react";

export default function WelcomePage() {
  const [params] = useSearchParams();
  const shop = params.get("shop");
  const email = params.get("email");
  const shopName = params.get("shopName");

  const [isReady, setIsReady] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate an auth completion check
    if (shop && email) {
      setIsReady(true);
    }
    setLoading(false);
  }, [shop, email]);

  return (
    <main style={{ fontFamily: "sans-serif", padding: "3rem", textAlign: "center", maxWidth: "600px", margin: "0 auto" }}>
      <h1>🎉 Welcome to DropX</h1>
      <p>
        {shopName ? (
          <>Your store <strong>{shopName}</strong> is now connected to DropX.</>
        ) : (
          <>Your Shopify store is now connected to DropX.</>
        )}
      </p>
      <p>
        DropX helps you build a powerful dropshipping business with curated products and fast local fulfillment in Egypt.
      </p>

      <button
        disabled={!isReady || loading}
        style={{
          marginTop: "2rem",
          padding: "1rem 2rem",
          fontSize: "1.2rem",
          backgroundColor: "#000",
          color: "#fff",
          border: "none",
          borderRadius: "4px",
          cursor: isReady ? "pointer" : "not-allowed",
          opacity: isReady ? 1 : 0.6,
        }}
        onClick={() => {
          window.location.href = "https://drop-x.co/products";
        }}
      >
        {loading ? "Checking..." : isReady ? "Start Exploring" : "Finishing Setup..."}
      </button>
    </main>
  );
}
```
