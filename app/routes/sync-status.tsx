import { LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { getSSMParam } from "../utils/getSSMParam";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");

  if (!shop) {
    throw new Response("Missing shop parameter", { status: 400 });
  }

  const apiBaseUrl = await getSSMParam("/dropx/dev/DROPX_API_BASE_URL");

  const response = await fetch(`${apiBaseUrl}/check-org-customer`, {
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