// File: app/utils/env.ts

export function getEnvVar(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`🚨 Missing required environment variable: ${key}`);
  }
  return value;
}

// ✅ DropX Shopify App Credentials
export const DROPX_SHOPIFY_API_KEY = getEnvVar("DROPX_SHOPIFY_API_KEY");
export const DROPX_SHOPIFY_API_SECRET = getEnvVar("DROPX_SHOPIFY_API_SECRET");
export const DROPX_APPLICATION_URL = getEnvVar("DROPX_APPLICATION_URL");
export const DROPX_DATABASE_URL = getEnvVar("DROPX_DATABASE_URL");

// ✅ Organization’s Shopify Store Credentials
export const ORG_SHOPIFY_STORE_URL = getEnvVar("ORG_SHOPIFY_STORE_URL");
export const ORG_SHOPIFY_API_KEY = getEnvVar("ORG_SHOPIFY_API_KEY");
export const ORG_SHOPIFY_API_SECRET = getEnvVar("ORG_SHOPIFY_API_SECRET");
export const ORG_SHOPIFY_ADMIN_API_TOKEN = getEnvVar("ORG_SHOPIFY_ADMIN_API_TOKEN");

// ✅ Organization’s Shopify Storefront Credentials
export const ORG_SHOPIFY_STOREFRONT_TOKEN = getEnvVar("ORG_SHOPIFY_STOREFRONT_TOKEN");
export const ORG_SHOPIFY_APP_PROXY_SUBPATH = getEnvVar("ORG_SHOPIFY_APP_PROXY_SUBPATH");
export const ORG_SHOPIFY_APP_PROXY_BASE_URL = getEnvVar("ORG_SHOPIFY_APP_PROXY_BASE_URL");

// ✅ App Proxy Configuration
export const SHOPIFY_APP_PROXY_SUBPATH = getEnvVar("SHOPIFY_APP_PROXY_SUBPATH");
export const SHOPIFY_APP_PROXY_BASE_URL = getEnvVar("SHOPIFY_APP_PROXY_BASE_URL");

// ✅ Shopify API Version (for keeping API calls consistent)
export const SHOPIFY_API_VERSION = getEnvVar("SHOPIFY_API_VERSION");

// ✅ Shopify Webhook Secret (for verifying HMAC signatures)
export const SHOPIFY_WEBHOOK_SECRET = getEnvVar("SHOPIFY_WEBHOOK_SECRET");

// ✅ Shopify Scopes (for OAuth permission settings)
export const SHOPIFY_SCOPES = getEnvVar("SHOPIFY_SCOPES");

// ✅ DropX Database Credentials
export const DROPX_DB_NAME = getEnvVar("DROPX_DB_NAME");
export const DROPX_DB_USER = getEnvVar("DROPX_DB_USER");
export const DROPX_DB_PASSWORD = getEnvVar("DROPX_DB_PASSWORD");

// ✅ Shopify GraphQL API Endpoint (for organization store)
export const ORG_SHOPIFY_GRAPHQL_ENDPOINT = `https://${ORG_SHOPIFY_STORE_URL}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`;

// ✅ Prisma Database Shadow URL (Fix for Heroku migration issues)
export const SHADOW_DATABASE_URL = getEnvVar("SHADOW_DATABASE_URL");

// ✅ Validate Required Variables Exist
const REQUIRED_ENV_VARS = [
"DROPX_SHOPIFY_API_KEY",
"DROPX_SHOPIFY_API_SECRET",
"DROPX_APPLICATION_URL",
"DROPX_DATABASE_URL",
"ORG_SHOPIFY_STORE_URL",
"ORG_SHOPIFY_API_KEY",
"ORG_SHOPIFY_API_SECRET",
"ORG_SHOPIFY_ADMIN_API_TOKEN",
"ORG_SHOPIFY_STOREFRONT_TOKEN",
"ORG_SHOPIFY_APP_PROXY_SUBPATH",
"ORG_SHOPIFY_APP_PROXY_BASE_URL",
"SHOPIFY_APP_PROXY_BASE_URL",
"SHOPIFY_API_VERSION",
"SHOPIFY_WEBHOOK_SECRET",
"SHOPIFY_SCOPES",
"DROPX_DB_NAME",
"DROPX_DB_USER",
"DROPX_DB_PASSWORD"
];

REQUIRED_ENV_VARS.forEach((key) => getEnvVar(key));