import { getSSMParam } from "../utils/getSSMParam";
import { findMerchantByDomain } from "./services/merchant.service";
import { checkCustomerExists, createCustomerInOrg } from "./services/shopify-org.service";

export const handler = async (event: any) => {
  console.log("📨 Incoming Event:", JSON.stringify(event, null, 2));

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method Not Allowed" }),
    };
  }

  try {
    const { shopDomain } = JSON.parse(event.body || "{}");

    if (!shopDomain) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing required parameter: shopDomain" }),
      };
    }

    const shop = await findMerchantByDomain(shopDomain);

    if (!shop) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: "Shop not found in DropX DB" }),
      };
    }

    const { email, name: shopName } = shop;

    const ORG_SHOPIFY_STORE_URL = await getSSMParam("ORG_SHOPIFY_STORE_URL");
    const ORG_SHOPIFY_ADMIN_API_TOKEN = await getSSMParam("ORG_SHOPIFY_ADMIN_API_TOKEN");
    const DROPX_APPLICATION_URL = await getSSMParam("DROPX_APPLICATION_URL");

    if (!ORG_SHOPIFY_STORE_URL || !ORG_SHOPIFY_ADMIN_API_TOKEN) {
      throw new Error("Missing Shopify Org Store credentials");
    }

    const exists = await checkCustomerExists(email, ORG_SHOPIFY_STORE_URL, ORG_SHOPIFY_ADMIN_API_TOKEN);

    if (!exists) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          needsRegistration: true,
          redirect: `https://drop-x.co/account/register?email=${encodeURIComponent(email)}`
        }),
      };
    }

    return {
      statusCode: 302,
      headers: {
        Location: `${DROPX_APPLICATION_URL}/app-installed?shop=${shopDomain}&email=${encodeURIComponent(email)}`,
      },
      body: "",
    };
  } catch (error) {
    console.error("❌ Merchant Sync Error:", error);
    
    if ((error as Error).message?.includes("Redirecting")) {
      const fallbackRedirect = `https://drop-x.co/account/register`;
      return {
        statusCode: 302,
        headers: {
          Location: fallbackRedirect,
          "Cache-Control": "no-cache",
          "Content-Type": "text/html",
        },
        body: `<html><head><meta http-equiv="refresh" content="0; URL='${fallbackRedirect}'" /></head><body>Redirecting...</body></html>`,
      };
    }

    return {
      statusCode: 500,
      body: JSON.stringify({ error: (error as Error).message || "Internal Server Error" }),
    };
  }
};
