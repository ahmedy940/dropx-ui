import { getSSMParam } from "../../utils/getSSMParam";
import { createHmac } from "crypto";
import { upsertShop } from "../../db/shop.db";
import { logActivity } from "../../db/activityLog.db";
import { addSessionToDB } from "../../db/session.db";
import { triggerMerchantSync } from "../services/syncTrigger.service";

export const authenticateShopify = async (event: any) => {
  console.log("Authenticating Shopify install request:", JSON.stringify(event, null, 2));

  try {
    console.debug("Fetching SSM parameters for Shopify OAuth");
    const DROPX_SHOPIFY_API_SECRET = await getSSMParam("DROPX_SHOPIFY_API_SECRET");
    const DROPX_SHOPIFY_API_KEY = await getSSMParam("DROPX_SHOPIFY_API_KEY");
    const DROPX_APPLICATION_URL = await getSSMParam("DROPX_APPLICATION_URL");
    console.debug("Retrieved SSM parameters:", {
      DROPX_SHOPIFY_API_SECRET,
      DROPX_SHOPIFY_API_KEY,
      DROPX_APPLICATION_URL
    });

    const { shop, hmac, code } = event.queryStringParameters || {};
    console.debug("Incoming OAuth Params:", { shop, hmac, code });

    if (!shop || !hmac || !code) {
      console.error("Missing required OAuth parameters:", { shop, hmac, code });
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing required OAuth parameters." }),
      };
    }

    // HMAC verification
    const rawParams = event.queryStringParameters || {};
    const sortedParams = Object.keys(rawParams)
      .filter((key) => key !== "hmac")
      .sort()
      .map((key) => `${key}=${rawParams[key]}`)
      .join("&");
    console.debug("Sorted params for HMAC verification:", sortedParams);

    const generatedHmac = createHmac("sha256", DROPX_SHOPIFY_API_SECRET!)
      .update(sortedParams)
      .digest("hex");

    if (generatedHmac !== hmac) {
      console.error("HMAC verification failed. Generated:", generatedHmac, "Provided:", hmac);
      return {
        statusCode: 403,
        body: JSON.stringify({ error: "Invalid HMAC." }),
      };
    }
    console.debug("HMAC verification successful.");

    // Exchange code for access token
    console.debug(`Exchanging code for access token for shop: ${shop}`);
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
    console.debug("Raw Shopify token exchange response:", rawText);
    const tokenData = JSON.parse(rawText);
    const accessToken = tokenData.access_token;
    console.debug("Access token retrieved:", accessToken ? "Token received" : "No token");

    if (!accessToken) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Failed to retrieve access token." }),
      };
    }

    // Optional: Fetch shop info
    console.debug(`Fetching shop info from Shopify for shop: ${shop}`);
    const shopInfoRes = await fetch(`https://${shop}/admin/api/2024-10/shop.json`, {
      headers: {
        "X-Shopify-Access-Token": accessToken,
        "Content-Type": "application/json",
      },
    });

    const shopData = await shopInfoRes.json();
    console.debug("Shop Info retrieved:", JSON.stringify(shopData, null, 2));
    if (!shopData.shop) {
      console.error("Shop info missing in response:", shopData);
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

    console.debug("Upserting shop into DB for shopDomain:", shop);
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
    console.debug("Shop upserted successfully.");

    console.debug("Adding session to DB for shopDomain:", shop);
    await addSessionToDB({
      shopDomain: shop,
      accessToken,
      email,
      state: "",
      scope: "read_analytics,write_checkouts,write_companies,write_customers,write_discounts,write_draft_orders,write_fulfillments,write_inventory,write_locales,write_locations,write_marketing_events,write_metaobjects,write_orders,write_payment_terms,write_price_rules,write_products,write_reports,write_resource_feedbacks,write_script_tags,write_shipping,write_themes,read_shop",
      isOnline: false,
      expires: null,
    });
    console.debug("Session added to DB successfully.");

    console.debug("Logging activity: App Installed via OAuth for shopDomain:", shop);
    await logActivity(shop, "App Installed via OAuth");
    console.debug("Activity logged successfully.");

    const syncResult = await triggerMerchantSync(shop, accessToken, name);
    
    if (syncResult.needsRegistration) {
      return {
        statusCode: 302,
        headers: {
          Location: `${DROPX_APPLICATION_URL}/register-redirect?shop=${shop}&email=${email}`,
        },
        body: "",
      };
    }

    return {
      statusCode: 302,
      headers: {
        Location: `${DROPX_APPLICATION_URL}/app-installed?shop=${shop}&email=${email}`,
      },
      body: "",
    };
    
  } catch (error) {
    console.error("OAuth Install Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal Server Error during OAuth" }),
    };
  }
};
