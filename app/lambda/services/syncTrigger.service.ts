import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";

export async function triggerMerchantSync(shop: string, email: string, shopName: string, force = false) {
  const lambda = new LambdaClient({ region: "us-east-1" });

  const payload = JSON.stringify({ shopDomain: shop, email, shopName, force });

  const command = new InvokeCommand({
    FunctionName: "dropx-lambdas-dev-merchantHandler",
    InvocationType: "RequestResponse",
    Payload: Buffer.from(payload),
  });

  try {
    const response = await lambda.send(command);
    if (!response.Payload) {
      throw new Error("No payload returned from Lambda");
    }
    const body = JSON.parse(Buffer.from(response.Payload).toString());
    console.info("[Merchant Sync] Lambda payload:", body);
    const needsRegistration = body?.needsRegistration || false;
 
    return {
      ok: true,
      message: `✅ Your store <b>${shop}</b> is successfully linked to DropX!`,
      needsRegistration
    };
  } catch (error) {
    console.error("Lambda invoke failed:", error);
    return {
      ok: false,
      message: `❌ Sync failed: ${(error as Error).message || "Unknown error"}`,
    };
  }
}