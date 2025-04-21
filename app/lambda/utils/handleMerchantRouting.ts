export function decideNextStep(
  shop: string,
  email: string,
  shopName?: string,
  needsRegistration = false
) {
  const query = new URLSearchParams({ shop, email });
  if (shopName) query.append("shopName", shopName);

  return {
    statusCode: 302,
    headers: {
      Location: needsRegistration
        ? `/register-redirect?${query.toString()}`
        : `/app-installed?shop=${shop}&email=${email}`,
    },
    body: "",
  };
}
