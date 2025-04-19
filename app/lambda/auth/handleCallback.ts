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
  
  let DROPX_APPLICATION_URL = "";
  try {
    const param = await getSSMParam("DROPX_APPLICATION_URL");
    DROPX_APPLICATION_URL = param ?? "";
    if (!DROPX_APPLICATION_URL) {
      throw new Error("Missing DROPX_APPLICATION_URL in SSM");
    }
    const query = event.queryStringParameters || {};
    const { shop, hmac, code } = query;

    if (!shop || !hmac || !code) {
      return {
        statusCode: 302,
        headers: {
          Location: `${DROPX_APPLICATION_URL}/auth/error?message=OAuth+error:+Missing+required+params`,
        },
        body: "",
      };
    }

    const isValid = await verifyOAuthRequest(query as Record<string, string>);
    if (!isValid) {
      return {
        statusCode: 302,
        headers: {
          Location: `${DROPX_APPLICATION_URL}/auth/error?message=HMAC+verification+failed`,
        },
        body: "",
      };
    }

    const DROPX_SHOPIFY_API_SECRET = await getSSMParam("DROPX_SHOPIFY_API_SECRET");
    const DROPX_SHOPIFY_API_KEY = await getSSMParam("DROPX_SHOPIFY_API_KEY");

    const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: DROPX_SHOPIFY_API_KEY,
        client_secret: DROPX_SHOPIFY_API_SECRET,
        code,
      }),
    });

    const contentType = tokenRes.headers.get("content-type") || "";
    const rawText = await tokenRes.text();

    if (!contentType.includes("application/json")) {
      return {
        statusCode: 302,
        headers: {
          Location: `${DROPX_APPLICATION_URL}/auth/error?message=Unexpected+response+format+from+Shopify`,
        },
        body: "",
      };
    }

    let tokenData;
    try {
      tokenData = JSON.parse(rawText);
    } catch (parseError) {
      return {
        statusCode: 302,
        headers: {
          Location: `${DROPX_APPLICATION_URL}/auth/error?message=Token+response+parsing+error`,
        },
        body: "",
      };
    }
    
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      return {
        statusCode: 302,
        headers: {
          Location: `${DROPX_APPLICATION_URL}/auth/error?message=Missing+access+token`,
        },
        body: "",
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
        statusCode: 302,
        headers: {
          Location: `${DROPX_APPLICATION_URL}/auth/error?message=Invalid+shop+data+received`,
        },
        body: "",
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
        Location: `https://o5p1jotn5j.execute-api.us-east-1.amazonaws.com/dev/post-install?shop=${encodeURIComponent(shop)}&email=${encodeURIComponent(email)}&shopName=${encodeURIComponent(name)}`,
      },
      body: "",
    };
  } catch (error) {
    console.error("OAuth Callback Error:", error, {
      shop: event?.queryStringParameters?.shop,
      code: event?.queryStringParameters?.code,
      hmac: event?.queryStringParameters?.hmac,
    });
    return {
      statusCode: 302,
      headers: {
        Location: `${DROPX_APPLICATION_URL}/auth/error?message=${encodeURIComponent((error as any)?.message || "Unhandled error")}`,
      },
      body: "",
    };
  }
};