import { APIGatewayProxyEvent } from "aws-lambda";
import { validateInstallQuery } from "../auth-service/utils/validateInstallQuery";
import { decideNextStep } from "./utils/handleMerchantRouting";
import { triggerMerchantSync } from "./services/syncTrigger.service";

export const handler = async (event: APIGatewayProxyEvent) => {
  console.info("[INFO] 🛬 Arrived at postInstallHandler", event);

  try {
    const { shop, email, shopName } = validateInstallQuery(event.queryStringParameters || {});
    if (!shop || !email) {
      console.warn("[WARN] Missing shop or email in query params:", { shop, email });
      return decideNextStep(shop, email, shopName, true);
    }

    const { ok, message, needsRegistration } = await triggerMerchantSync(shop, email, shopName);
    console.info("[INFO] ✅ triggerMerchantSync result:", message);

    return decideNextStep(shop, email, shopName, needsRegistration);
  } catch (e) {
    console.error("[ERROR] ❌ Post-install failed:", e);
    return {
      statusCode: 500,
      headers: { "Content-Type": "text/html" },
      body: renderErrorHtml((e as any)?.message || "Internal error occurred during installation."),
    };
  }
};

const renderErrorHtml = (message: string) => `
  <div style="font-family:sans-serif;padding:2rem;text-align:center;">
    <h1>😓 Oops! Something went wrong</h1>
    <p>${message}</p>
  </div>
`;
