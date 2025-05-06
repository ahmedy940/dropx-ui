import { exchangeShopifyToken } from "./exchangeShopifyToken";
import { getSSMParam } from "../../utils/getSSMParam";

export async function exchangeCodeForToken(shop: string, code: string) {
  const apiKey = await getSSMParam("DROPX_SHOPIFY_API_KEY");
  const apiSecret = await getSSMParam("DROPX_SHOPIFY_API_SECRET");
  if (!apiKey || !apiSecret) throw new Error("Missing API credentials");

  return exchangeShopifyToken(shop, code, apiKey, apiSecret);
}