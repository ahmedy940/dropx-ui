import { getSSMParam } from "../utils/getSSMParam";

export async function getDropxConfig() {
  const DROPX_SHOPIFY_API_KEY = await getSSMParam("/dropx/dev/DROPX_SHOPIFY_API_KEY");
  const DROPX_SHOPIFY_API_SECRET = await getSSMParam("/dropx/dev/DROPX_SHOPIFY_API_SECRET");
  const DROPX_APPLICATION_URL = await getSSMParam("/dropx/dev/DROPX_APPLICATION_URL");
  const DROPX_DATABASE_URL = await getSSMParam("/dropx/dev/DROPX_DATABASE_URL");

  const ORG_SHOPIFY_STORE_URL = await getSSMParam("/dropx/dev/ORG_SHOPIFY_STORE_URL");
  const ORG_SHOPIFY_API_KEY = await getSSMParam("/dropx/dev/ORG_SHOPIFY_API_KEY");
  const ORG_SHOPIFY_API_SECRET = await getSSMParam("/dropx/dev/ORG_SHOPIFY_API_SECRET");
  const ORG_SHOPIFY_ADMIN_API_TOKEN = await getSSMParam("/dropx/dev/ORG_SHOPIFY_ADMIN_API_TOKEN");

  const SHOPIFY_APP_PROXY_SUBPATH = await getSSMParam("/dropx/dev/ORG_SHOPIFY_APP_PROXY_SUBPATH");
  const SHOPIFY_APP_PROXY_BASE_URL = await getSSMParam("/dropx/dev/ORG_SHOPIFY_APP_PROXY_BASE_URL");

  const SHOPIFY_API_VERSION = await getSSMParam("/dropx/dev/SHOPIFY_API_VERSION");
  const SHOPIFY_WEBHOOK_SECRET = await getSSMParam("/dropx/dev/SHOPIFY_WEBHOOK_SECRET");
  const SHOPIFY_SCOPES = await getSSMParam("/dropx/dev/SHOPIFY_SCOPES");

  const ORG_SHOPIFY_GRAPHQL_ENDPOINT = `https://${ORG_SHOPIFY_STORE_URL}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`;

  const SHADOW_DATABASE_URL = await getSSMParam("/dropx/dev/SHADOW_DATABASE_URL");

  return {
    DROPX_SHOPIFY_API_KEY,
    DROPX_SHOPIFY_API_SECRET,
    DROPX_APPLICATION_URL,
    DROPX_DATABASE_URL,
    ORG_SHOPIFY_STORE_URL,
    ORG_SHOPIFY_API_KEY,
    ORG_SHOPIFY_API_SECRET,
    ORG_SHOPIFY_ADMIN_API_TOKEN,
    SHOPIFY_APP_PROXY_SUBPATH,
    SHOPIFY_APP_PROXY_BASE_URL,
    SHOPIFY_API_VERSION,
    SHOPIFY_WEBHOOK_SECRET,
    SHOPIFY_SCOPES,
    ORG_SHOPIFY_GRAPHQL_ENDPOINT,
    SHADOW_DATABASE_URL,
  };
}