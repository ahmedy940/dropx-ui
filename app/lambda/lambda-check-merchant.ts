import { findMerchantByDomain } from "./services/merchant.service";
import { v4 as uuidv4 } from "uuid";
import { APIGatewayProxyEvent } from "aws-lambda";

export const handler = async (event: APIGatewayProxyEvent) => {
  const traceId = uuidv4();
  console.info(`[INFO][${traceId}] Incoming event: ${JSON.stringify(event)}`);

  try {
    const body = JSON.parse(event.body || "{}");
    const { shopDomain } = body;

    if (!shopDomain) {
      console.warn(`[WARN][${traceId}] Missing shopDomain in request body.`);
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing shopDomain in request body." }),
      };
    }

    const merchant = await findMerchantByDomain(shopDomain);

    console.info(`[INFO][${traceId}] Merchant found: ${!!merchant}`);

    return {
      statusCode: 200,
      body: JSON.stringify({ found: !!merchant, merchantId: merchant?.id || null }),
    };
  } catch (error) {
    console.error(`[ERROR][${traceId}] Error checking merchant domain:`, error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal server error." }),
    };
  }
};
