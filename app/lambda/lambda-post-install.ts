import { extractQueryParams } from "./utils/queryString";
import { triggerMerchantSync } from "./services/syncTrigger.service";

export const handler = async (event: any) => {
  console.log("🛬 Arrived at postInstallHandler", event);

  try {
    const { shop, email, shopName, error } = {
      ...extractQueryParams(event.queryStringParameters),
      error: extractQueryParams(event.queryStringParameters).error,
    };

    if (error) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "text/html" },
        body: `<h2>❌ ${error}</h2>`,
      };
    }

    if (!shop || !email) {
      const query = new URLSearchParams();
      if (shop) query.append("shop", shop);
      if (email) query.append("email", email);
      if (shopName) query.append("shopName", shopName);

      return {
        statusCode: 302,
        headers: {
          Location: `/register-redirect?${query.toString()}`,
        },
        body: "",
      };
    }

    const { ok, message } = await triggerMerchantSync(shop, email, shopName);
    console.log("✅ triggerMerchantSync result:", message);

    return {
      statusCode: 200,
      headers: { "Content-Type": "text/html" },
      body: `
        <div style="font-family:sans-serif;padding:2rem;text-align:center;">
          <h1>Welcome to DropX 🎉</h1>
          <p>${message || "Your setup is complete!"}</p>
        </div>
      `,
    };
  } catch (e) {
    console.error("❌ Post-install failed:", e);
    return {
      statusCode: 500,
      headers: { "Content-Type": "text/html" },
      body: `
        <div style="font-family:sans-serif;padding:2rem;text-align:center;">
          <h1>😓 Oops! Something went wrong</h1>
          <p>${(e as any)?.message || "Internal error occurred during installation."}</p>
        </div>
      `,
    };
  }
};
