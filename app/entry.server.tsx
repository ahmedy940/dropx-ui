import { PassThrough, Readable } from "stream";
import { RemixServer } from "@remix-run/react";
import type { EntryContext } from "@remix-run/node";
import { renderToPipeableStream } from "react-dom/server";
import LRUCache from "lru-cache"; // ✅ Added Cache Layer

/**
 * ✅ Securely retrieve environment variables
 */
const getEnvVar = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    console.error(`🚨 Missing required environment variable: ${key}`);
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

// ✅ Updated Environment Variables (Using Latest `.env`)
const DROPX_SHOPIFY_API_KEY = getEnvVar("DROPX_SHOPIFY_API_KEY");
const DROPX_SHOPIFY_API_SECRET = getEnvVar("DROPX_SHOPIFY_API_SECRET");
const DROPX_APPLICATION_URL = getEnvVar("DROPX_APPLICATION_URL");
const DROPX_DATABASE_URL = getEnvVar("DROPX_DATABASE_URL");

const ORG_SHOPIFY_STORE_URL = getEnvVar("ORG_SHOPIFY_STORE_URL");
const ORG_SHOPIFY_API_KEY = getEnvVar("ORG_SHOPIFY_API_KEY");
const ORG_SHOPIFY_API_SECRET = getEnvVar("ORG_SHOPIFY_API_SECRET");
const ORG_SHOPIFY_ADMIN_API_TOKEN = getEnvVar("ORG_SHOPIFY_ADMIN_API_TOKEN");
const ORG_SHOPIFY_STOREFRONT_TOKEN = getEnvVar("ORG_SHOPIFY_STOREFRONT_TOKEN");

const SHOPIFY_APP_PROXY_SUBPATH = getEnvVar("SHOPIFY_APP_PROXY_SUBPATH");
const SHOPIFY_APP_PROXY_BASE_URL = getEnvVar("SHOPIFY_APP_PROXY_BASE_URL");

// ✅ Added LRU Cache to optimize data fetching
const cache = new LRUCache({
  max: 1000, // Max cache entries
  ttl: 1000 * 60 * 5, // Cache for 5 minutes
});

export default function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  remixContext: EntryContext
) {
  return new Promise((resolve, reject) => {
    let didError = false;

    const { pipe, abort } = renderToPipeableStream(
      <RemixServer context={remixContext} url={request.url} />,
      {
        onShellReady: () => {
          try {
            const passthrough = new PassThrough();
            const stream = new ReadableStream({
              start(controller) {
                passthrough.on("data", (chunk) => controller.enqueue(chunk));
                passthrough.on("end", () => controller.close());
                passthrough.on("error", (err) => {
                  console.error("[ENTRY.SERVER ERROR]: Stream error:", err);
                  controller.error(err);
                });
              },
            });

            responseHeaders.set("Content-Type", "text/html");
            pipe(passthrough);

            resolve(
              new Response(stream, {
                status: didError ? 500 : responseStatusCode,
                headers: responseHeaders,
              })
            );
          } catch (error) {
            console.error("[ENTRY.SERVER ERROR]: Failed to process stream:", error);
            reject(error);
          }
        },
        onShellError: (err) => {
          console.error("[ENTRY.SERVER ERROR]: Shell rendering failed:", err);
          reject(err);
        },
        onError: (error) => {
          didError = true;
          console.error("[ENTRY.SERVER ERROR]: Unexpected error:", error);
        },
      }
    );

    // 🚀 **Increased Timeout to 15 Seconds**
    setTimeout(() => {
      console.warn("[ENTRY.SERVER]: Rendering took too long, aborting...");
      abort();
    }, 15000); // ⏳ Increased timeout from **7s** to **15s** for Heroku cold starts
  });
}