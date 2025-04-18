import {
  graphqlRequest,
  CHECK_CUSTOMER_QUERY,
  CREATE_CUSTOMER_MUTATION,
} from "../lambda-shopify-graphql";

export async function checkCustomerExists(email: string, orgUrl: string, token: string): Promise<boolean> {
  const checkRes = await graphqlRequest(
    CHECK_CUSTOMER_QUERY,
    orgUrl,
    token,
    { email }
  );

  return checkRes.success &&
    checkRes.data?.data?.customers?.edges?.length > 0;
}

export async function createCustomerInOrg(
  email: string,
  shopName: string,
  orgUrl: string,
  token: string
): Promise<void> {
  const createRes = await graphqlRequest(
    CREATE_CUSTOMER_MUTATION,
    orgUrl,
    token,
    {
      input: {
        email,
        firstName: shopName,
      },
    }
  );

  const userErrors = createRes.data?.data?.customerCreate?.userErrors;
  if (userErrors && userErrors.length > 0) {
    throw new Error(userErrors.map((e: any) => e.message).join(", "));
  }

  if (!createRes.success || !createRes.data?.data?.customerCreate?.customer) {
    throw new Error("Failed to create customer");
  }
}
