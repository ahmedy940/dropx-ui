

export function validateCallbackQuery(query: Record<string, string | undefined>) {
  const { shop, hmac, code, state } = query;
  if (!shop || !hmac || !code || !state) {
    throw new Error("Missing required OAuth parameters");
  }
  return { shop, hmac, code, state };
}