

import { json, LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");

  if (!shop) {
    throw new Response("Missing shop parameter", { status: 400 });
  }

  // Simulated sync check (replace with real DB or API call)
  const isSynced = shop.endsWith(".myshopify.com"); // Simplified condition

  return json({
    shop,
    status: isSynced ? "✅ Synced" : "❌ Not Found in Org Store",
  });
}

export default function SyncStatusPage() {
  const { shop, status } = useLoaderData<typeof loader>();

  return (
    <div style={{ padding: 20 }}>
      <h1>Sync Status</h1>
      <p><strong>Shop:</strong> {shop}</p>
      <p><strong>Status:</strong> {status}</p>
      <p>This page is useful for internal QA and debugging purposes.</p>
    </div>
  );
}