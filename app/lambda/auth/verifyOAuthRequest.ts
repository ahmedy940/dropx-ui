import { createHmac } from "crypto";
import { getSSMParam } from "../../utils/getSSMParam";

/**
 * Verifies Shopify HMAC signature from OAuth or Webhook requests.
 * Returns true if verification succeeds, false otherwise.
 */
export const verifyOAuthRequest = async (queryParams: Record<string, string>): Promise<boolean> => {
  const DROPX_SHOPIFY_API_SECRET = await getSSMParam("DROPX_SHOPIFY_API_SECRET");

  const sortedParams = Object.keys(queryParams)
    .filter((key) => key !== "hmac")
    .sort()
    .map((key) => `${key}=${queryParams[key]}`)
    .join("&");

  const generatedHmac = createHmac("sha256", DROPX_SHOPIFY_API_SECRET!)
    .update(sortedParams)
    .digest("hex");

  return generatedHmac === queryParams.hmac;
};