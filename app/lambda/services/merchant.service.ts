import { getPrisma } from "../utils/db.server";

export async function findMerchantByDomain(shopDomain: string) {
  const prisma = await getPrisma();
  return prisma.shop.findUnique({ where: { shopDomain } });
}

export async function isMerchantRegistered(shopDomain: string): Promise<boolean> {
  const merchant = await findMerchantByDomain(shopDomain);
  return !!merchant;
}
