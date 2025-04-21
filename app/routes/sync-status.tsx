
import { LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");

  if (!shop) {
    throw new Response("Missing shop parameter", { status: 400 });
  }

  const response = await fetch("https://o5p1jotn5j.execute-api.us-east-1.amazonaws.com/dev/check-org-customer", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ shopDomain: shop }),
  });

  const result = await response.json();

  return Response.json({
    shop,
    status: result?.needsRegistration ? "❌ Not Found in Org Store" : "✅ Synced",
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