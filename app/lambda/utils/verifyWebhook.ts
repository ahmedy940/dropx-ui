import { createHmac, timingSafeEqual } from "crypto";

/**
 * ✅ Validates the HMAC signature for Shopify webhook security
 */
export function verifyWebhookHMAC(rawBody: string, hmacHeader: string, webhookSecret: string): boolean {
  try {
    const digest = createHmac("sha256", webhookSecret)
      .update(rawBody, "utf8")
      .digest("base64");

    const receivedBuffer = Buffer.from(hmacHeader, "base64");
    const digestBuffer = Buffer.from(digest, "base64");

    if (receivedBuffer.length !== digestBuffer.length) return false;
    return timingSafeEqual(receivedBuffer, digestBuffer);
  } catch (error) {
    console.error("[VERIFY HMAC ERROR]:", error);
    return false;
  }
}