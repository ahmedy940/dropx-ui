

import { getSSMParam } from "../../utils/getSSMParam";
import { verifyOAuthRequest } from "./verifyOAuthRequest";
import { upsertShop } from "../../db/shop.db";
import { addSessionToDB } from "../../db/session.db";
import { logActivity } from "../../db/activityLog.db";

/**
 * Handles Shopify OAuth redirect by verifying HMAC, exchanging the token, storing shop info, and redirecting to post-install.
 */
export const handleCallback = async (event: any) => {
  console.log("🔄 Handling OAuth callback");

  try {
    const query = event.queryStringParameters || {};
    const { shop, hmac, code } = query;

    if (!shop || !hmac || !code) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing required OAuth parameters." }),
      };
    }

    const isValid = await verifyOAuthRequest(query as Record<string, string>);
    if (!isValid) {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: "Invalid HMAC." }),
      };
    }

    const DROPX_SHOPIFY_API_SECRET = await getSSMParam("DROPX_SHOPIFY_API_SECRET");
    const DROPX_SHOPIFY_API_KEY = await getSSMParam("DROPX_SHOPIFY_API_KEY");
    const DROPX_APPLICATION_URL = await getSSMParam("DROPX_APPLICATION_URL");

    const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: DROPX_SHOPIFY_API_KEY,
        client_secret: DROPX_SHOPIFY_API_SECRET,
        code,
      }),
    });

    const rawText = await tokenRes.text();
    const tokenData = JSON.parse(rawText);
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Failed to retrieve access token." }),
      };
    }

    const shopInfoRes = await fetch(`https://${shop}/admin/api/2024-10/shop.json`, {
      headers: {
        "X-Shopify-Access-Token": accessToken,
        "Content-Type": "application/json",
      },
    });

    const shopData = await shopInfoRes.json();
    if (!shopData.shop) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Failed to retrieve shop info from Shopify." }),
      };
    }

    const email = shopData.shop?.email || "";
    const name = shopData.shop?.name || "";
    const plan = shopData.shop?.plan_display_name || "";
    const primaryDomain = shopData.shop?.primary_domain?.host || "";
    const currencyCode = shopData.shop?.currency || "";
    const timezone = shopData.shop?.iana_timezone || "";
    const isCheckoutSupported = shopData.shop?.checkout_api_supported || false;

    await upsertShop({
      shopDomain: shop,
      email,
      name,
      plan,
      primaryDomain,
      currencyCode,
      timezone,
      isCheckoutSupported,
      accessToken,
    });

    await addSessionToDB({
      shopDomain: shop,
      accessToken,
      email,
      state: "",
      scope: "read_analytics,write_checkouts,write_companies,write_customers,write_discounts,write_draft_orders,write_fulfillments,write_inventory,write_locales,write_locations,write_marketing_events,write_metaobjects,write_orders,write_payment_terms,write_price_rules,write_products,write_reports,write_resource_feedbacks,write_script_tags,write_shipping,write_themes,read_shop",
      isOnline: false,
      expires: null,
    });

    await logActivity(shop, "App Installed via OAuth");

    return {
      statusCode: 302,
      headers: {
        Location: `${DROPX_APPLICATION_URL}/post-install?shop=${encodeURIComponent(shop)}&email=${encodeURIComponent(email)}&shopName=${encodeURIComponent(name)}`,
      },
      body: "",
    };
  } catch (error) {
    console.error("OAuth Callback Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal Server Error during OAuth Callback" }),
    };
  }
};