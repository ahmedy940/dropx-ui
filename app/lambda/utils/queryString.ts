type QueryParamsResult =
  | { shop: string; email: string; shopName: string; state: string }
  | { error: string };

export function extractQueryParams(
  query: Record<string, string | undefined>
): QueryParamsResult {
  const { shop, email, shopName, state } = query || {};
  if (!shop || !email || !shopName || !state) {
    return { error: "Missing required query parameters." };
  }
  return { shop, email, shopName, state };
}