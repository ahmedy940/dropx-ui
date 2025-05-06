

import { fetchShopInfo } from "./fetchShopInfo";

export async function fetchShopDetails(shop: string, accessToken: string) {
  const shopData = await fetchShopInfo(shop, accessToken);
  if (!shopData) throw new Error("Invalid shop data received");
  return shopData;
}