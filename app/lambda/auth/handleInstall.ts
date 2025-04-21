import { getSSMParam } from "../../utils/getSSMParam";
import { createHmac, createHash, randomBytes } from "crypto";
import { createCookie } from "@remix-run/node";
import { upsertShop } from "../../db/shop.db";
import { logActivity } from "../../db/activityLog.db";
import { addSessionToDB } from "../../db/session.db";
import { triggerMerchantSync } from "../services/syncTrigger.service";

const SHOPIFY_APP_SCOPE = "read_analytics,write_checkouts,write_companies,write_customers,write_discounts,write_draft_orders,write_fulfillments,write_inventory,write_locales,write_locations,write_marketing_events,write_metaobjects,write_orders,write_payment_terms,write_price_rules,write_products,write_reports,write_resource_feedbacks,write_script_tags,write_shipping,write_themes,read_shop";

export const authenticateShopify = async (event: any) => {
  console.log("Authenticating Shopify install request:", JSON.stringify(event, null, 2));

  try {
    const DROPX_SHOPIFY_API_KEY = await getSSMParam("DROPX_SHOPIFY_API_KEY");
    const DROPX_APPLICATION_URL = await getSSMParam("DROPX_APPLICATION_URL");
    if (!DROPX_APPLICATION_URL) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Missing application redirect URL." }),
      };
    }

    const { shop } = event.queryStringParameters || {};
    if (!shop) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing required shop parameter." }),
      };
    }

    const state = createHash("sha256").update(randomBytes(16)).digest("hex");

    const stateCookie = createCookie("oauth_state", {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 300,
    });

    const setCookieHeader = await stateCookie.serialize(state);

    const redirectToShopifyOAuth = `https://${shop}/admin/oauth/authorize?client_id=${DROPX_SHOPIFY_API_KEY}&scope=${SHOPIFY_APP_SCOPE}&redirect_uri=${encodeURIComponent(DROPX_APPLICATION_URL + "/shopify/callback")}&state=${state}`;

    return {
      statusCode: 302,
      headers: {
        Location: redirectToShopifyOAuth,
        "Set-Cookie": setCookieHeader,
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
