import { getSSMParam } from "../../utils/getSSMParam";

export async function buildRedirectUrl(shop: string, email: string, name: string) {
  const POST_INSTALL_URL = await getSSMParam("DROPX_POST_INSTALL_REDIRECT");
  if (!POST_INSTALL_URL) throw new Error("Missing post-install URL");

  return `${POST_INSTALL_URL}?shop=${encodeURIComponent(shop)}&email=${encodeURIComponent(email)}&shopName=${encodeURIComponent(name)}`;
}