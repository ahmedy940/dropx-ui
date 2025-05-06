import { getSSMParam } from "../utils/getSSMParam";
import { createHash, randomBytes } from "crypto";
import { storeOAuthState, getOAuthState } from "app/auth-service/utils/stateStore";
import { validateCallbackQuery } from "./utils/validateCallbackQuery";
import { verifyOAuthRequest } from "app/auth-service/utils/verifyOAuthRequest";
import { exchangeCodeForToken } from "./utils/exchangeCodeForToken";
import { fetchShopDetails } from "../lambda/utils/fetchShopDetails";
import { upsertShopInDb } from "../lambda/utils/upsertSopInDB";
import { buildRedirectUrl } from "./utils/buildRedirectUrl";
import { redirectWithError } from "app/auth-service/utils/redirectWithError";

const SHOPIFY_APP_SCOPE = "read_analytics,write_checkouts,write_companies,write_customers,write_discounts,write_draft_orders,write_fulfillments,write_inventory,write_locales,write_locations,write_marketing_events,write_metaobjects,write_orders,write_payment_terms,write_price_rules,write_products,write_reports,write_resource_feedbacks,write_script_tags,write_shipping,write_themes,read_shop";

export const authenticateShopify = async (event: any) => {
  try {
    const DROPX_SHOPIFY_API_KEY = await getSSMParam("DROPX_SHOPIFY_API_KEY");
    const DROPX_APPLICATION_URL = await getSSMParam("DROPX_APPLICATION_URL");
    if (!DROPX_SHOPIFY_API_KEY || !DROPX_APPLICATION_URL) {
      throw new Error("Missing required environment variables");
    }

    const { shop, code, state } = event.queryStringParameters || {};

    // Handle callback
    if (code && state) {
      const query = validateCallbackQuery(event.queryStringParameters || {});
      const isValid = await verifyOAuthRequest(query);
      if (!isValid) return redirectWithError("HMAC+verification+failed", DROPX_APPLICATION_URL);

      const storedState = getOAuthState(query.shop);
      if (!storedState || storedState !== query.state) {
        return redirectWithError("Invalid+or+expired+OAuth+state+parameter", DROPX_APPLICATION_URL);
      }

      const accessToken = await exchangeCodeForToken(query.shop, query.code);
      if (!accessToken) return redirectWithError("Missing+access+token", DROPX_APPLICATION_URL);

      const shopData = await fetchShopDetails(query.shop, accessToken);
      const { email, name } = await upsertShopInDb(query.shop, accessToken, shopData);

      const redirectUrl = await buildRedirectUrl(query.shop, email, name);
      return {
        statusCode: 302,
        headers: { Location: redirectUrl },
        body: "",
      };
    }

    // Handle initial install
    if (!shop) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing required shop parameter." }),
      };
    }

    const newState = createHash("sha256").update(randomBytes(16)).digest("hex");
    storeOAuthState(shop, newState);

    const redirectToShopifyOAuth = `https://${shop}/admin/oauth/authorize?client_id=${DROPX_SHOPIFY_API_KEY}&scope=${SHOPIFY_APP_SCOPE}&redirect_uri=${encodeURIComponent(DROPX_APPLICATION_URL + "/shopify/auth")}&state=${newState}`;

    return {
      statusCode: 302,
      headers: { Location: redirectToShopifyOAuth },
      body: "",
    };
  } catch (error: any) {
    console.error("[OAuth Error]", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "OAuth handler failed", message: error.message }),
    };
  }
};
