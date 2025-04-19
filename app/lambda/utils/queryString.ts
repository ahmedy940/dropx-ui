export function extractQueryParams(query: any) {
  const { shop, email, shopName } = query || {};
  if (!shop || !email || !shopName) {
    return { error: "Missing required query parameters." };
  }
  return { shop, email, shopName };
}