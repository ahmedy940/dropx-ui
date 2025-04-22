export async function fetchShopInfo(shop: string, accessToken: string): Promise<any> {
  const shopInfoRes = await fetch(`https://${shop}/admin/api/2024-10/shop.json`, {
    headers: {
      "X-Shopify-Access-Token": accessToken,
      "Content-Type": "application/json",
    },
  });

  try {
    const data = await shopInfoRes.json();
    return data.shop || null;
  } catch {
    return null;
  }
}
