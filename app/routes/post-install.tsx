

import { useSearchParams } from "@remix-run/react";

export default function PostInstall() {
  const [params] = useSearchParams();
  const shop = params.get("shop") || "your shop";
  const shopName = params.get("shopName") || "";

  return (
    <div style={{ fontFamily: "sans-serif", padding: "3rem", textAlign: "center" }}>
      <h1>🎉 Welcome to DropX!</h1>
      <p style={{ fontSize: "1.2rem", marginTop: "1rem" }}>
        ✅ Your store <strong>{shop}</strong>{shopName ? ` (${shopName})` : ""} is now successfully linked to DropX.
      </p>
      <p style={{ marginTop: "2rem" }}>
        You're all set to start syncing products and orders.
      </p>
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