

import { createHmac } from "crypto";
import { SHOPIFY_WEBHOOK_SECRET } from "../../db/config";

/**
 * ✅ Validates the HMAC signature for Shopify webhook security
 */
export function verifyWebhookHMAC(rawBody: string, hmacHeader: string): boolean {
  try {
    const digest = createHmac("sha256", SHOPIFY_WEBHOOK_SECRET!)
      .update(rawBody, "utf8")
      .digest("base64");

    return digest === hmacHeader;
  } catch (error) {
    console.error("[VERIFY HMAC ERROR]:", error);
    return false;
  }
}