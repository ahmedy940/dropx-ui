import { handleProductWebhook } from "./webhook-product";

export const handler = async (event: any) => {
  console.log("[INFO] [WEBHOOK]: Handling Shopify Webhook Event...");
  try {
    return await handleProductWebhook(event);
  } catch (error) {
    console.error("[ERROR] [WEBHOOK]: Failed to handle webhook", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Internal Server Error" }),
    };
  }
};