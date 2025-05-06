export async function fetchShopInfo(shop: string, accessToken: string): Promise<any> {
  const shopInfoRes = await fetch(`https://${shop}/admin/api/2024-10/shop.json`, {
    headers: {
      "X-Shopify-Access-Token": accessToken,
      "Content-Type": "application/json",
    },
  });

  try {
    if (!shopInfoRes.ok) {
      console.error(`Failed to fetch shop info: ${shopInfoRes.status} ${shopInfoRes.statusText}`);
      return null;
    }
    const data = await shopInfoRes.json();
    return data.shop || null;
  } catch (error) {
    console.error("Error parsing shop info response:", error);
    return null;
  }
}
