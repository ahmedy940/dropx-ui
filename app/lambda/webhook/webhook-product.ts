

import { verifyWebhookHMAC } from "../utils/verifyWebhook";
import { fetchMerchantByEmail, registerMerchant } from "../lambda-shopify-merchant";
import { getShopByEmail } from "../lambda-shopify-shop";
import { copyProductToMerchantStore } from "../lambda-shopify-product";

export async function handleProductWebhook(event: any) {
  try {
    const hmacHeader = event.headers["X-Shopify-Hmac-SHA256"];
    if (!hmacHeader) {
      console.error("[WEBHOOK ERROR]: Missing HMAC header.");
      return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized request." }) };
    }

    const isValidHmac = verifyWebhookHMAC(event.body, hmacHeader);
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