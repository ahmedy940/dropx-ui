import { getSSMParam } from "../../utils/getSSMParam";

export async function buildRedirectUrl(shop: string, email: string, name: string) {
  const baseRedirect = await getSSMParam("DROPX_POST_INSTALL_REDIRECT");
  if (!baseRedirect) throw new Error("Missing post-install URL");

  const targetPath = shop.startsWith("quickstart") ? "/welcome" : "/dashboard";

  return `${baseRedirect}${targetPath}?shop=${encodeURIComponent(shop)}&email=${encodeURIComponent(email)}&shopName=${encodeURIComponent(name)}`;
}