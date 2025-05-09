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

    if (process.env.NODE_ENV === "development") {
      console.log("[DEBUG] Calculated HMAC:", digest);
      console.log("[DEBUG] Received HMAC:", hmacHeader);
    }

    if (receivedBuffer.length !== digestBuffer.length) return false;
    return timingSafeEqual(receivedBuffer, digestBuffer);
  } catch (error) {
    console.error("[ERROR] [VERIFY HMAC ERROR]:", error);
    return false;
  }
}