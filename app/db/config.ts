import { getSSMParam } from "../utils/getSSMParam";

// ✅ DropX Shopify App Credentials (From Shopify Partner Account)
export const DROPX_SHOPIFY_API_KEY = await getSSMParam("/dropx/dev/DROPX_SHOPIFY_API_KEY");
export const DROPX_SHOPIFY_API_SECRET = await getSSMParam("/dropx/dev/DROPX_SHOPIFY_API_SECRET");
export const DROPX_APPLICATION_URL = await getSSMParam("/dropx/dev/DROPX_APPLICATION_URL");
export const DROPX_DATABASE_URL = await getSSMParam("/dropx/dev/DROPX_DATABASE_URL");

// ✅ Organization’s Shopify Store Credentials
export const ORG_SHOPIFY_STORE_URL = await getSSMParam("/dropx/dev/ORG_SHOPIFY_STORE_URL");
export const ORG_SHOPIFY_API_KEY = await getSSMParam("/dropx/dev/ORG_SHOPIFY_API_KEY");
export const ORG_SHOPIFY_API_SECRET = await getSSMParam("/dropx/dev/ORG_SHOPIFY_API_SECRET");
export const ORG_SHOPIFY_ADMIN_API_TOKEN = await getSSMParam("/dropx/dev/ORG_SHOPIFY_ADMIN_API_TOKEN");

// ✅ App Proxy Configuration
export const SHOPIFY_APP_PROXY_SUBPATH = await getSSMParam("/dropx/dev/ORG_SHOPIFY_APP_PROXY_SUBPATH");
export const SHOPIFY_APP_PROXY_BASE_URL = await getSSMParam("/dropx/dev/ORG_SHOPIFY_APP_PROXY_BASE_URL");

// ✅ New Variables for Merchant & Product Syncing
export const SHOPIFY_API_VERSION = await getSSMParam("/dropx/dev/SHOPIFY_API_VERSION");
export const SHOPIFY_WEBHOOK_SECRET = await getSSMParam("/dropx/dev/SHOPIFY_WEBHOOK_SECRET");
export const SHOPIFY_SCOPES = await getSSMParam("/dropx/dev/SHOPIFY_SCOPES");

// ✅ Shopify GraphQL API Endpoint (for org store)
export const ORG_SHOPIFY_GRAPHQL_ENDPOINT = `https://${ORG_SHOPIFY_STORE_URL}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`;

// ✅ Prisma Database Shadow URL (Fix Heroku Migration Issues)
export const SHADOW_DATABASE_URL = await getSSMParam("/dropx/dev/SHADOW_DATABASE_URL");