import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { findMerchantByDomain } from "./services/merchant.service";
import { checkCustomerExists } from "./services/shopify-org.service";
import { getSSMParam } from "../utils/getSSMParam";

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    let body;
    try {
      body = JSON.parse(event.body || "{}");
    } catch (parseErr) {
      console.error("[ERROR] Invalid JSON body", parseErr);
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Invalid JSON in request body." }),
      };
    }

    console.info("[Request Body]", body);
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
        body: JSON.stringify({ error: "Merchant not found in DropX database." }),
      };
    }

    const email = merchant.email;
    console.info("[Merchant Email]", email);
    if (!email) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Merchant does not have an email." }),
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

    const exists = await checkCustomerExists(email, orgUrl, orgToken);
    console.info("[Customer Exists]", exists);

    return {
      statusCode: 200,
      body: JSON.stringify({ needsRegistration: !exists }),
    };
  } catch (error) {
    const body = event.body || "{}";
    let shopDomain = "";
    try {
      shopDomain = JSON.parse(body).shopDomain || "";
    } catch {
      shopDomain = "";
    }
    console.error(`[ERROR] Failed for shopDomain: ${shopDomain}`, error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal server error." }),
    };
  }
};