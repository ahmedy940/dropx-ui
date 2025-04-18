import { getPrisma } from "../utils/db.server";

export async function findMerchantByDomain(shopDomain: string) {
  const prisma = await getPrisma();
  return prisma.shop.findUnique({ where: { shopDomain } });
}
