type QueryParamsResult =
  | { shop: string; email: string; shopName: string }
  | { error: string };

export function extractQueryParams(
  query: Record<string, string | undefined>
): QueryParamsResult {
  const { shop, email, shopName } = query || {};
  if (!shop || !email || !shopName) {
    return { error: "Missing required query parameters." };
  }
  return { shop, email, shopName };
}