import { findMerchantByDomain } from "./services/merchant.service";
import { createCustomerInOrg } from "./services/shopify-org.service";
import { getSSMParam } from "../utils/getSSMParam";

export const handler = async (event: any) => {
  try {
    const body = JSON.parse(event.body || "{}");
    const { shopDomain } = body;

    if (!shopDomain) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing shopDomain in request body." }),
      };
    }

    const merchant = await findMerchantByDomain(shopDomain);
    if (!merchant) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: "Merchant not found in DropX." }),
      };
    }

    const email = merchant.email;
    const shopName = merchant.name;

    if (!email || !shopName) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Merchant record missing email or name." }),
      };
    }

    const orgUrl = await getSSMParam("DROPX_SHOPIFY_ORG_STORE_URL");
    const orgToken = await getSSMParam("DROPX_SHOPIFY_ORG_ADMIN_TOKEN");

    if (!orgUrl || !orgToken) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Missing org store configuration in SSM." }),
      };
    }

    await createCustomerInOrg(email, shopName, orgUrl, orgToken);

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, message: "Customer created in org store." }),
    };
  } catch (error) {
    console.error("Error creating org customer:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal server error." }),
    };
  }
};