import { verifyWebhookHMAC } from "../utils/verifyWebhook";
import { getDropxConfig } from "../../db/config";
// TODO: Replace with real merchant service when available
async function fetchMerchantByEmail(email: string): Promise<boolean> {
  console.warn(`[PLACEHOLDER] fetchMerchantByEmail called for ${email}`);
  return true; // Simulated existence
}

async function registerMerchant(email: string): Promise<boolean> {
  console.warn(`[PLACEHOLDER] registerMerchant called for ${email}`);
  return true; // Simulated registration
}
// Placeholder: getShopByEmail implementation will be replaced when the module is available.
async function getShopByEmail(email: string): Promise<{ shopDomain: string; accessToken: string } | null> {
  // TODO: Replace this with actual implementation from lambda-shopify-shop
  console.warn("[WARNING]: getShopByEmail is using a placeholder implementation.");
  return null;
}
import { copyProductToMerchantStore } from "../lambda-shopify-product";

export async function handleProductWebhook(event: any) {
  try {
    const hmacHeader = event.headers["X-Shopify-Hmac-SHA256"];
    if (!hmacHeader) {
      console.error("[WEBHOOK ERROR]: Missing HMAC header.");
      return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized request." }) };
    }

    const { SHOPIFY_WEBHOOK_SECRET } = await getDropxConfig();
    if (!SHOPIFY_WEBHOOK_SECRET) {
      console.error("[WEBHOOK ERROR]: Missing SHOPIFY_WEBHOOK_SECRET from config.");
      return { statusCode: 500, body: JSON.stringify({ error: "Webhook secret not configured." }) };
    }

    const isValidHmac = verifyWebhookHMAC(event.body, hmacHeader, SHOPIFY_WEBHOOK_SECRET);
    if (!isValidHmac) {
      console.error("[WEBHOOK ERROR]: HMAC verification failed.");
      return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized request." }) };
    }

    const body = JSON.parse(event.body);
    const { email, product } = body;

    if (!email || !product) {
      console.error("[WEBHOOK ERROR]: Missing required parameters.");
      return { statusCode: 400, body: JSON.stringify({ error: "Missing required parameters." }) };
    }

    console.log(`[WEBHOOK]: Received product add event for email: ${email}`);

    let merchantExists = await fetchMerchantByEmail(email);
    if (!merchantExists) {
      console.log(`[WEBHOOK]: Merchant email (${email}) not found. Creating...`);
      const created = await registerMerchant(email);

      if (!created) {
        console.error(`[WEBHOOK ERROR]: Failed to create merchant`);
        return { statusCode: 500, body: JSON.stringify({ error: "Failed to register merchant" }) };
      }
    }

    console.log(`[WEBHOOK]: Merchant verified. Fetching shop details...`);
    const shopData = await getShopByEmail(email);

    if (!shopData || !shopData.accessToken) {
      console.error(`[WEBHOOK ERROR]: No access token found for ${email}'s store`);
      return { statusCode: 403, body: JSON.stringify({ error: "Merchant shop not authenticated." }) };
    }

    console.log(`[WEBHOOK]: Merchant shop access token retrieved, syncing product...`);
    const syncResult = await copyProductToMerchantStore(product, shopData.shopDomain, shopData.accessToken);

    if (!syncResult.success) {
      console.error("[WEBHOOK ERROR]: Failed to sync product", syncResult.error);
      return { statusCode: 500, body: JSON.stringify({ error: "Failed to sync product" }) };
    }

    console.log(`[WEBHOOK]: Successfully synced product ${product.id} to ${shopData.shopDomain}`);
    return { statusCode: 200, body: JSON.stringify({ success: "Product synced successfully." }) };
  } catch (error) {
    console.error("[WEBHOOK ERROR]:", error);
    return { statusCode: 500, body: JSON.stringify({ error: "Internal server error." }) };
  }
}