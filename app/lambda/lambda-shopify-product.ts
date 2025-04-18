import { graphqlRequest } from "./lambda-shopify-graphql"; // Adjust import if needed

import { getSSMParam } from "../utils/getSSMParam";

/**
 * ✅ Fetch Product Details from Organization Store (AWS Lambda Version)
 */
export const fetchProductFromOrgStore = async (productId: string) => {
  console.log(`[ORG STORE]: Fetching product ${productId}...`);

  const query = `
    query FetchProduct($id: ID!) {
      product(id: $id) {
        id
        title
        bodyHtml
        vendor
        productType
        variants(first: 10) {
          edges {
            node {
              id
              price
              sku
              inventoryQuantity
            }
          }
        }
        images(first: 5) {
          edges {
            node {
              src
            }
          }
        }
      }
    }
  `;

  const variables = { id: `gid://shopify/Product/${productId}` };

  try {
    const [ORG_SHOPIFY_STORE_URL, ORG_SHOPIFY_ADMIN_API_TOKEN] = await Promise.all([
      getSSMParam("ORG_SHOPIFY_STORE_URL"),
      getSSMParam("ORG_SHOPIFY_ADMIN_API_TOKEN")
    ]);
    const response = await graphqlRequest(
      query,
      ORG_SHOPIFY_STORE_URL || "",
      ORG_SHOPIFY_ADMIN_API_TOKEN || "",
      variables
    );
    return response.data?.product || null;
  } catch (error) {
    console.error("[GRAPHQL ERROR]: Failed to fetch product", error);
    return null;
  }
};

/**
 * ✅ Copy Product to Merchant Store (AWS Lambda Version)
 */
export const copyProductToMerchantStore = async (product: any, shopDomain: string, accessToken: string) => {
  try {
    console.log(`[PRODUCT SYNC]: Copying product to ${shopDomain}...`);

    const mutation = `
      mutation CopyProduct($input: ProductInput!) {
        productCreate(input: $input) {
          product {
            id
            title
          }
        }
      }
    `;

    const variables = {
      input: {
        title: product.title,
        bodyHtml: product.bodyHtml,
        vendor: product.vendor,
        productType: product.productType,
        variants: product.variants,
        images: product.images,
      },
    };

    const response = await graphqlRequest(mutation, shopDomain, accessToken, variables);
    return { success: true, data: response };
  } catch (error) {
    console.error("[PRODUCT SYNC ERROR]: Failed to copy product", error);
    return { success: false, error };
  }
};

/**
 * ✅ AWS Lambda Handler - Routes API requests
 */
export const handler = async (event: any) => {
  console.log("Incoming Event:", JSON.stringify(event, null, 2));

  const { path, httpMethod, queryStringParameters, body } = event;
  let response;

  try {
    if (path.includes("fetch-product") && httpMethod === "GET") {
      const { productId } = queryStringParameters || {};
      if (!productId) throw new Error("Missing productId parameter");

      response = await fetchProductFromOrgStore(productId);
    } else if (path.includes("copy-product") && httpMethod === "POST") {
      const { product, shopDomain, accessToken } = JSON.parse(body);
      if (!product || !shopDomain || !accessToken) throw new Error("Missing required parameters");

      response = await copyProductToMerchantStore(product, shopDomain, accessToken);
    } else {
      response = { error: "Invalid Route" };
    }

    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error) {
    console.error("Error in handler:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal Server Error" }),
    };
  }
};