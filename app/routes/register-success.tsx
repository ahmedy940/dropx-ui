import { useSearchParams } from "@remix-run/react";

export default function RegisterSuccess() {
  const [searchParams] = useSearchParams();
  const email = searchParams.get("email") || "";
  const shop = searchParams.get("shop") || "";
  const shopName = searchParams.get("shopName") || "";

  return (
    <div style={{ padding: "3rem", textAlign: "center", fontFamily: "sans-serif" }}>
      <h1>🎉 Registration Successful!</h1>
      <p style={{ marginTop: "1rem", fontSize: "1.2rem" }}>
        Your store <strong>{shop}</strong>{shopName && ` (${shopName})`} has been registered.
      </p>
      <p>You're now ready to link it to DropX and begin syncing products.</p>
      <a
        href={`/post-install?email=${encodeURIComponent(email)}&shop=${encodeURIComponent(shop)}&shopName=${encodeURIComponent(shopName)}`}
        style={{
          marginTop: "2rem",
          display: "inline-block",
          padding: "0.75rem 1.5rem",
          fontSize: "1rem",
          backgroundColor: "#111827",
          color: "#fff",
          borderRadius: "6px",
          textDecoration: "none",
        }}
      >
        Continue to Sync
      </a>
    </div>
  );
}
