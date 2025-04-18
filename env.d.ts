/// <reference types="vite/client" />
/// <reference types="@remix-run/node" />

interface ImportMetaEnv {
    readonly VITE_SHOPIFY_API_KEY: string;
    readonly VITE_SHOPIFY_API_SECRET: string;
    readonly VITE_DROPX_SHOPIFY_STORE: string;
    readonly VITE_ADMIN_API_ACCESS_TOKEN: string;
    readonly VITE_SHOPIFY_WEBHOOK_SECRET: string;
    readonly VITE_ADMIN_API_SCOPES?: string; // Optional
    readonly VITE_ORG_SHOPIFY_STORE_URL: string;
    readonly VITE_SCOPES: string;
    readonly VITE_DROPX_APPLICATION_URL: string;
    readonly VITE_DROPX_SCOPES: string;
    readonly VITE_ORG_SHOPIFY_ADMIN_API_TOKEN: string;
    readonly VITE_ORG_Admin_API_access_scopes?: string;
    readonly VITE_ORG_Storefront_API_access_scopes?: string;
  
    // Add other environment variables here...
}
  
interface ImportMeta {
    readonly env: ImportMetaEnv;
}