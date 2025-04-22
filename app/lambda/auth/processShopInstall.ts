import { upsertShop } from "../../db/shop.db";
import { addSessionToDB } from "../../db/session.db";
import { logActivity } from "../../db/activityLog.db";

export async function processShopInstall(shop: string, accessToken: string, shopData: any) {
  const email = shopData.email || "";
  const name = shopData.name || "";
  const plan = shopData.plan_display_name || "";
  const primaryDomain = shopData.primary_domain?.host || "";
  const currencyCode = shopData.currency || "";
  const timezone = shopData.iana_timezone || "";
  const isCheckoutSupported = shopData.checkout_api_supported || false;

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

  return { email, name };
}
