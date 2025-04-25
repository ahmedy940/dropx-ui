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