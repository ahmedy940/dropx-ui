import { getShopByDomain } from "../../db/shop.db";

export const authenticateOrgShopify = async (shopDomain: string) => {
  if (!shopDomain) throw new Error("Missing shop domain");

  const shop = await getShopByDomain(shopDomain);
  if (!shop) throw new Error("Shop not found in DropX org");

  return shop;
};
