import { getPrisma } from "./prisma";

/**
 * Fetch shop details by email
 * @param email - The unique shop email
 * @returns The shop record
 */
export async function getShopByEmail(email: string) {
  const prisma = await getPrisma();
  return await prisma.shop.findUnique({
    where: { email },
  });
}

/**
 * Fetch shop details by shop domain
 * @param shopDomain - The unique shop domain (myshopify domain)
 * @returns The shop record
 */
export async function getShopByDomain(shopDomain: string) {
  const prisma = await getPrisma();
  return await prisma.shop.findUnique({
    where: { shopDomain },
  });
}

/**
 * Create or update shop details in the database
 * @param shopData - Object containing shop information
 * @returns The created or updated shop record
 */
export async function upsertShop(shopData: {
  shopDomain: string;
  email: string;
  name: string;
  primaryDomain?: string;
  currencyCode?: string;
  timezone?: string;
  plan?: string;
  isCheckoutSupported?: boolean;
  accessToken?: string;
}) {
  const prisma = await getPrisma();
  return await prisma.shop.upsert({
    where: { email: shopData.email }, // ✅ Using email as the main identifier
    update: {
      shopDomain: shopData.shopDomain,
      name: shopData.name,
      primaryDomain: shopData.primaryDomain,
      currencyCode: shopData.currencyCode,
      timezone: shopData.timezone,
      plan: shopData.plan,
      isCheckoutSupported: shopData.isCheckoutSupported,
      accessToken: shopData.accessToken,
      updatedAt: new Date(),
    },
    create: {
      shopDomain: shopData.shopDomain,
      email: shopData.email,
      name: shopData.name,
      primaryDomain: shopData.primaryDomain,
      currencyCode: shopData.currencyCode,
      timezone: shopData.timezone,
      plan: shopData.plan,
      isCheckoutSupported: shopData.isCheckoutSupported ?? true,
      accessToken: shopData.accessToken,
    },
  });
}

/**
 * Delete a shop by email (e.g., on uninstallation)
 * @param email - The shop email to delete
 * @returns The deleted shop record
 */
export async function deleteShop(email: string) {
  const prisma = await getPrisma();
  return await prisma.shop.delete({
    where: { email },
  });
}

/**
 * Check if a shop exists in the database
 * @param email - The shop email
 * @returns Boolean indicating whether the shop exists
 */
export async function shopExists(email: string) {
  const prisma = await getPrisma();
  const shop = await prisma.shop.findUnique({
    where: { email },
    select: { id: true },
  });
  return !!shop;
}