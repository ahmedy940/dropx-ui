import { getSSMParam } from "../../utils/getSSMParam";
import { verifyOAuthRequest } from "./verifyOAuthRequest";
import { parse } from "cookie";
import { exchangeShopifyToken } from "./exchangeShopifyToken";
import { fetchShopInfo } from "./fetchShopInfo";
import { processShopInstall } from "./processShopInstall";
import { redirectWithError } from "./redirectWithError";

/**
 * Handles Shopify OAuth redirect by verifying HMAC, exchanging the token, storing shop info, and redirecting to post-install.
 */
export const handleCallback = async (event: any) => {
  console.log("🔄 Handling OAuth callback");
  
  const DROPX_APPLICATION_URL = await getSSMParam("DROPX_APPLICATION_URL");
  if (!DROPX_APPLICATION_URL) {
    throw new Error("Missing DROPX_APPLICATION_URL in SSM");
  }
  const query = event.queryStringParameters || {};
  const { shop, hmac, code, state } = query;

  if (!shop || !hmac || !code) {
    return redirectWithError("OAuth+error:+Missing+required+params", DROPX_APPLICATION_URL);
  }

  const isValid = await verifyOAuthRequest(query as Record<string, string>);
  if (!isValid) {
    return redirectWithError("HMAC+verification+failed", DROPX_APPLICATION_URL);
  }

  const cookieHeader = event.headers?.cookie || event.headers?.Cookie || "";
  const cookies = parse(cookieHeader);
  const expectedState = cookies["oauth_state"];

  if (!state || !expectedState || state !== expectedState) {
    console.warn("OAuth state mismatch:", { received: state, expected: expectedState });
    return redirectWithError("Invalid+OAuth+state+parameter", DROPX_APPLICATION_URL);
  }

  const DROPX_SHOPIFY_API_SECRET = await getSSMParam("DROPX_SHOPIFY_API_SECRET");
  const DROPX_SHOPIFY_API_KEY = await getSSMParam("DROPX_SHOPIFY_API_KEY");

  const accessToken = await exchangeShopifyToken(shop, code, DROPX_SHOPIFY_API_KEY!, DROPX_SHOPIFY_API_SECRET!);

  if (!accessToken) {
    return redirectWithError("Missing+access+token", DROPX_APPLICATION_URL);
  }

  const shopData = await fetchShopInfo(shop, accessToken);

  if (!shopData) {
    return redirectWithError("Invalid+shop+data+received", DROPX_APPLICATION_URL);
  }

  const { email, name } = await processShopInstall(shop, accessToken, shopData);

  const POST_INSTALL_URL = await getSSMParam("DROPX_POST_INSTALL_REDIRECT");
  if (!POST_INSTALL_URL) {
    return redirectWithError("Missing+post+install+URL", DROPX_APPLICATION_URL);
  }
  
  return {
    statusCode: 302,
    headers: {
      Location: `${POST_INSTALL_URL}?shop=${encodeURIComponent(shop)}&email=${encodeURIComponent(email)}&shopName=${encodeURIComponent(name)}`,
    },
    body: "",
  };
};