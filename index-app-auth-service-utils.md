# Code Index for app/auth-service/utils

## app/auth-service/utils/processShopInstall.ts

```ts
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

## app/auth-service/utils/fetchShopInfo.ts

```ts
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

## app/auth-service/utils/upsertSopInDB.ts

```ts


import { processShopInstall } from "./processShopInstall";

export async function upsertShopInDb(shop: string, accessToken: string, shopData: any) {
  return processShopInstall(shop, accessToken, shopData);
}
```

## app/auth-service/utils/queryString.ts

```ts
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
}
```

## app/auth-service/utils/exchangeCodeForToken.ts

```ts


import { exchangeShopifyToken } from "./exchangeShopifyToken";
import { getSSMParam } from "../../../utils/getSSMParam";

export async function exchangeCodeForToken(shop: string, code: string) {
  const apiKey = await getSSMParam("DROPX_SHOPIFY_API_KEY");
  const apiSecret = await getSSMParam("DROPX_SHOPIFY_API_SECRET");
  if (!apiKey || !apiSecret) throw new Error("Missing API credentials");

  return exchangeShopifyToken(shop, code, apiKey, apiSecret);
}
```

## app/auth-service/utils/handleMerchantRouting.ts

```ts
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
import { extractQueryParams } from "./queryString";

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

## app/auth-service/utils/orgAuth.ts

```ts
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

## app/auth-service/utils/fetchShopDetails.ts

```ts


import { fetchShopInfo } from "./fetchShopInfo";

export async function fetchShopDetails(shop: string, accessToken: string) {
  const shopData = await fetchShopInfo(shop, accessToken);
  if (!shopData) throw new Error("Invalid shop data received");
  return shopData;
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

## app/auth-service/utils/verifyWebhook.ts

```ts
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
}
```

## app/auth-service/utils/db.server.ts

```ts
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
}
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
