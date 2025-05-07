# Code Index for app/auth-service/utils

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
