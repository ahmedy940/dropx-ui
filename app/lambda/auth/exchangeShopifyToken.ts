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
