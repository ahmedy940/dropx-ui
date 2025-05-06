

import { processShopInstall } from "./processShopInstall";

export async function upsertShopInDb(shop: string, accessToken: string, shopData: any) {
  return processShopInstall(shop, accessToken, shopData);
}