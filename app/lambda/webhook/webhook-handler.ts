import { handleProductWebhook } from "./webhook-product";

export const handler = async (event: any) => {
  console.log("[WEBHOOK]: Handling Shopify Webhook Event...");
  return await handleProductWebhook(event);
};