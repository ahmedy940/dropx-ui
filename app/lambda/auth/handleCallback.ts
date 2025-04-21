import { getSSMParam } from "../../utils/getSSMParam";
import { verifyOAuthRequest } from "./verifyOAuthRequest";
import { upsertShop } from "../../db/shop.db";
import { addSessionToDB } from "../../db/session.db";
import { logActivity } from "../../db/activityLog.db";

const redirectWithError = (message: string, baseUrl: string) => ({
  statusCode: 302,
  headers: {
    Location: `${baseUrl}/auth/error?message=${encodeURIComponent(message)}`,
  },
  body: "",
});

/**
 * Handles Shopify OAuth redirect by verifying HMAC, exchanging the token, storing shop info, and redirecting to post-install.
 */
export const handleCallback = async (event: any) => {
  console.log("🔄 Handling OAuth callback");
  
  const DROPX_APPLICATION_URL = await getSSMParam("DROPX_APPLICATION_URL");
  if (!DROPX_APPLICATION_URL) {
    throw new Error("Missing DROPX_APPLICATION_URL in SSM");
  }
  const query = event.queryStringParameters || {};
  const { shop, hmac, code, state } = query;

  if (!shop || !hmac || !code) {
    return redirectWithError("OAuth+error:+Missing+required+params", DROPX_APPLICATION_URL);
  }

  const isValid = await verifyOAuthRequest(query as Record<string, string>);
  if (!isValid) {
    return redirectWithError("HMAC+verification+failed", DROPX_APPLICATION_URL);
  }

  const expectedState = event.headers?.Cookie?.split(';').find((c: string) => c.trim().startsWith('oauth_state='))?.split('=')[1];
  if (!state || !expectedState || state !== expectedState) {
    return redirectWithError("Invalid+OAuth+state+parameter", DROPX_APPLICATION_URL);
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

  let tokenData;
  try {
    tokenData = await tokenRes.json();
  } catch (parseError) {
    return redirectWithError("Token response parsing error", DROPX_APPLICATION_URL);
  }
  
  const accessToken = tokenData.access_token;

  if (!accessToken) {
    return redirectWithError("Missing+access+token", DROPX_APPLICATION_URL);
  }

  const shopInfoRes = await fetch(`https://${shop}/admin/api/2024-10/shop.json`, {
    headers: {
      "X-Shopify-Access-Token": accessToken,
      "Content-Type": "application/json",
    },
  });

  let shopData;
  try {
    shopData = await shopInfoRes.json();
  } catch (shopParseError) {
    return redirectWithError("Failed+to+parse+shop+info+response", DROPX_APPLICATION_URL);
  }
  
  if (!shopData.shop) {
    return redirectWithError("Invalid+shop+data+received", DROPX_APPLICATION_URL);
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

  const POST_INSTALL_URL = await getSSMParam("DROPX_POST_INSTALL_REDIRECT");
  if (!POST_INSTALL_URL) {
    return redirectWithError("Missing+post+install+URL", DROPX_APPLICATION_URL);
  }
  
  return {
    statusCode: 302,
    headers: {
      Location: `${POST_INSTALL_URL}?shop=${encodeURIComponent(shop)}&email=${encodeURIComponent(email)}&shopName=${encodeURIComponent(name)}`,
    },
    body: "",
  };
};