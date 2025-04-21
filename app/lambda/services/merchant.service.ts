import { getPrisma } from "../utils/db.server";
import type { Shop } from "@prisma/client";

export async function findMerchantByDomain(shopDomain: string): Promise<Shop | null> {
  const prisma = await getPrisma();
  return prisma.shop.findUnique({ where: { shopDomain } });
}

export async function isMerchantRegistered(shopDomain: string): Promise<boolean> {
  const merchant = await findMerchantByDomain(shopDomain);
  return !!merchant;
}

export async function findOrThrowMerchantByDomain(shopDomain: string): Promise<Shop> {
  const merchant = await findMerchantByDomain(shopDomain);
  if (!merchant) {
    throw new Error(`Merchant not found for domain: ${shopDomain}`);
  }
  return merchant;
}
