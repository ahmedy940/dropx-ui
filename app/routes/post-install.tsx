

import { useEffect, useState } from "react";
import { useSearchParams } from "@remix-run/react";

export default function PostInstall() {
  const [params] = useSearchParams();
  const shop = params.get("shop") || "your shop";
  const shopName = params.get("shopName") || "";
  const email = params.get("email") || "";
  const [isLinked, setIsLinked] = useState<boolean | null>(null);

  useEffect(() => {
    if (shop && email) {
      fetch("https://o5p1jotn5j.execute-api.us-east-1.amazonaws.com/dev/post-install", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ shop, email }),
      })
        .then((res) => {
          setIsLinked(res.status === 200);
        })
        .catch((err) => {
          console.error("Sync failed:", err);
          setIsLinked(false);
        });
    }
  }, [shop, email]);

  return (
    <div style={{ fontFamily: "sans-serif", padding: "3rem", textAlign: "center" }}>
      <h1>🎉 Welcome to DropX!</h1>
      {isLinked === null ? (
        <p>Checking store status...</p>
      ) : isLinked ? (
        <>
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
        </>
      ) : (
        <>
          <p style={{ fontSize: "1.2rem", marginTop: "1rem", color: "red" }}>
            🚫 We couldn't find your store in DropX. Please register to complete your setup.
          </p>
          <a
            href={`https://drop-x.co/account/register?email=${email}&shop=${shop}`}
            style={{
              marginTop: "2rem",
              display: "inline-block",
              padding: "0.75rem 1.5rem",
              fontSize: "1rem",
              backgroundColor: "#c53030",
              color: "#fff",
              borderRadius: "6px",
              textDecoration: "none",
            }}
          >
            Register Your Store
          </a>
        </>
      )}
    </div>
  );
}