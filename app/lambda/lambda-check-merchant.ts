import { findMerchantByDomain } from "./services/merchant.service";

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

    return {
      statusCode: 200,
      body: JSON.stringify({ found: !!merchant }),
    };
  } catch (error) {
    console.error("Error checking merchant domain:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal server error." }),
    };
  }
};
