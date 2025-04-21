Console.log("");import fetch from "node-fetch";
import { authenticateOrgShopify } from "./lambda-shopify-auth";

/**
 * ✅ AWS Lambda Proxy Handler
 */
export const handler = async (event: any) => {
  console.log("Incoming Proxy Event:", JSON.stringify(event, null, 2));

  const { httpMethod, queryStringParameters, headers, body } = event;
  let response;

  try {
    const endpoint = queryStringParameters?.endpoint;

    if (!endpoint) {
      console.error("[PROXY ERROR]: Missing endpoint parameter.");
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing endpoint parameter" }),
      };
    }

    // if (endpoint === "product-add-webhook") {
    //   if (httpMethod !== "POST") {
    //     return {
    //       statusCode: 405,
    //       body: JSON.stringify({ error: "Method Not Allowed" }),
    //     };
    //   }

    //   console.log(`[PROXY]: Handling product add webhook...`);
    //   return await handleProductAddWebhook(event);
    // }

    // ✅ Handle Merchant Sync API Proxying
    if (endpoint === "merchant-sync") {
      return await fetchProxy("https://your-app.com/api/merchant.sync", httpMethod, headers, body);
    }

    // ✅ Handle Product Fetch API Proxying
    if (endpoint === "product-fetch") {
      return await fetchProxy("https://your-app.com/api/product.fetch", httpMethod, headers, body);
    }

    // ✅ Handle Product Sync API Proxying
    if (endpoint === "product-sync") {
      return await fetchProxy("https://your-app.com/api/product.sync", httpMethod, headers, body);
    }

    // ✅ Secure API Request Forwarding to Organization Shopify Admin API
    const authResult = await authenticateOrgShopify();
    if ('statusCode' in authResult && 'body' in authResult) {
      return authResult;
    }
    const { storeUrl, adminToken } = authResult;
    console.log(`[PROXY]: Forwarding request to ${storeUrl}/admin/api/2025-01/${endpoint}.json`);

    return await fetchProxy(`https://${storeUrl}/admin/api/2025-01/${endpoint}.json`, httpMethod, {
      "X-Shopify-Access-Token": adminToken,
      "Content-Type": "application/json",
    });

  } catch (error) {
    console.error("[PROXY ERROR]:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal Server Error" }),
    };
  }
};

/**
 * ✅ Generic Fetch Proxy Function
 */
const fetchProxy = async (url: string, method: string, headers: any, body?: any) => {
  try {
    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      console.error(`[PROXY ERROR]: Failed to fetch data from ${url}`);
      return {
        statusCode: response.status,
        body: JSON.stringify({ error: `Failed to fetch data from ${url}` }),
      };
    }

    const data = await response.json();
    console.log(`[PROXY]: Successfully fetched data from ${url}`);

    return {
      statusCode: 200,
      body: JSON.stringify(data),
    };
  } catch (error) {
    console.error("[FETCH PROXY ERROR]:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Fetch Proxy Internal Server Error" }),
    };
  }
};