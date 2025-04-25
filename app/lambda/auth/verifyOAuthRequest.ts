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