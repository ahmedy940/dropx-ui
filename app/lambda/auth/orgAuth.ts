import { getShopByDomain } from "../../db/shop.db";

export const authenticateOrgShopify = async (shopDomain: string) => {
  if (!shopDomain) {
    console.warn("[org-auth] Missing shop domain");
    throw new Error("Missing shop domain");
  }

  const shop = await getShopByDomain(shopDomain);
  if (!shop) {
    console.warn(`[org-auth] Shop not found for domain: ${shopDomain}`);
    throw new Error("Shop not found in DropX organization");
  }

  return shop;
};
