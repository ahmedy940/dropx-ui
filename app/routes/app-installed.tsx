import { useSearchParams } from "@remix-run/react";

export default function AppInstalled() {
  const [searchParams] = useSearchParams();
  const shop = searchParams.get("shop") || "";
  const shopName = searchParams.get("shopName") || "";

  return (
    <div style={{ padding: "3rem", textAlign: "center", fontFamily: "sans-serif" }}>
      <h1>🎉 You're Already Connected!</h1>
      <p style={{ marginTop: "1rem", fontSize: "1.2rem" }}>
        Your store <strong>{shop}</strong>{shopName && ` (${shopName})`} is already linked to DropX.
      </p>
      <p>You can now start managing your synced products and orders.</p>
      <a
        href="https://drop-x.co/account/login"
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
        Go to DropX Dashboard
      </a>
    </div>
  );
}
