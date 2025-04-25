import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";

/**
 * ✅ GraphQL Queries & Mutations for Shopify Store Management
 */

// 🔹 Fetch Shop Details
export const FETCH_SHOP_QUERY = `
  query {
    shop {
      myshopifyDomain
      name
      email
      primaryDomain { url }
      currencyCode
      ianaTimezone
      plan { displayName }
      checkoutApiSupported
      createdAt
      updatedAt
    }
  }
`;

// 🔹 Check if a Customer Exists
export const CHECK_CUSTOMER_QUERY = `
  query checkCustomer($email: String!) {
    customers(first: 1, query: "email:$email") {
      edges {
        node {
          id
          email
        }
      }
    }
  }
`;

// 🔹 Create a New Customer
export const CREATE_CUSTOMER_MUTATION = `
  mutation createCustomer($input: CustomerInput!) {
    customerCreate(input: $input) {
      customer {
        id
        email
      }
      userErrors {
        field
        message
      }
    }
  }
`;

// 🔹 Fetch Store Products
export const FETCH_PRODUCTS_QUERY = `
  query {
    products(first: 50) {
      edges {
        node {
          id
          title
          descriptionHtml
          vendor
          productType
          handle
          createdAt
          updatedAt
          images(first: 5) {
            edges {
              node {
                originalSrc
                altText
              }
            }
          }
          variants(first: 10) {
            edges {
              node {
                id
                title
                price
                sku
              }
            }
          }
        }
      }
    }
  }
`;

// 🔹 Check if a Product Exists
export const CHECK_PRODUCT_QUERY = `
  query checkProduct($title: String!) {
    products(first: 1, query: "title:$title") {
      edges {
        node {
          id
          title
        }
      }
    }
  }
`;

// 🔹 Create a New Product
export const CREATE_PRODUCT_MUTATION = `
  mutation createProduct($input: ProductInput!) {
    productCreate(input: $input) {
      product {
        id
        title
      }
      userErrors {
        field
        message
      }
    }
  }
`;

// 🔹 Update an Existing Product
export const UPDATE_PRODUCT_MUTATION = `
  mutation updateProduct($id: ID!, $input: ProductInput!) {
    productUpdate(id: $id, input: $input) {
      product {
        id
        title
      }
      userErrors {
        field
        message
      }
    }
  }
`;

// 🔹 Delete a Product
export const DELETE_PRODUCT_MUTATION = `
  mutation deleteProduct($id: ID!) {
    productDelete(input: { id: $id }) {
      deletedProductId
      userErrors {
        field
        message
      }
    }
  }
`;

/**
 * ✅ Generic Function to Send GraphQL Requests
 */
export const graphqlRequest = async (
  query: string,
  shopDomain: string,
  accessToken: string,
  variables?: any
) => {
  try {
    const response = await fetch(`https://${shopDomain}/admin/api/2024-10/graphql.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken,
      },
      body: JSON.stringify({ query, variables }),
    });

    const data = await response.json();

    if (!data || data.errors) {
      console.error("[ERROR] [GRAPHQL ERROR]:", data.errors || "Unknown error");
      return { success: false, error: data.errors };
    }

    return { success: true, data };
  } catch (error) {
    console.error("[ERROR] [API ERROR]: GraphQL request failed.", error);
    return { success: false, error };
  }
};

/**
 * ✅ AWS Lambda Handler - Handles API Gateway Requests
 */
export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const { path, httpMethod, queryStringParameters, body } = event;
  console.info("[INFO] [HANDLER START]:", { path, httpMethod });

  let response;

  try {
    if (httpMethod === "POST") {
      const parsedBody = body ? JSON.parse(body) : {};
      const { shopDomain, accessToken, query, variables } = parsedBody;

      if (!shopDomain || !accessToken || !query) {
        console.warn("[WARN] [MISSING PARAMS]:", { shopDomain, accessToken, query });
        throw new Error("Missing required parameters");
      }

      response = await graphqlRequest(query, shopDomain, accessToken, variables);

      if (response.success) {
        console.info("[INFO] [GRAPHQL SUCCESS]");
      } else {
        console.error("[ERROR] [GRAPHQL FAILURE]:", response.error);
      }
    } else {
      response = { error: "Invalid Route or Method" };
    }

    const statusCode = response && response.success ? 200 : 400;
    return {
      statusCode,
      body: JSON.stringify(response),
    };
  } catch (error) {
    console.error("[ERROR] [Handler]", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: "Internal Server Error" }),
    };
  }
};