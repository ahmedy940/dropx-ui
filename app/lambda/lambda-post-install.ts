import { validateInstallQuery } from "./utils/validateInstallQuery";
import { decideNextStep } from "./utils/handleMerchantRouting";
import { triggerMerchantSync } from "./services/syncTrigger.service";

export const handler = async (event: any) => {
  console.log("🛬 Arrived at postInstallHandler", event);

  try {
    const { shop, email, shopName } = validateInstallQuery(event.queryStringParameters);

    if (!shop || !email) {
      return decideNextStep(shop, email, shopName, true);
    }

    const { ok, message, needsRegistration } = await triggerMerchantSync(shop, email, shopName);
    console.log("✅ triggerMerchantSync result:", message);

    return decideNextStep(shop, email, shopName, needsRegistration);
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
