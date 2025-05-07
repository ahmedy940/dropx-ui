import { useSearchParams } from "@remix-run/react";
import { useEffect, useState } from "react";

export default function WelcomePage() {
  const [params] = useSearchParams();
  const shop = params.get("shop");
  const email = params.get("email");
  const shopName = params.get("shopName");

  const [isReady, setIsReady] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate an auth completion check
    if (shop && email) {
      setIsReady(true);
    }
    setLoading(false);
  }, [shop, email]);

  return (
    <main style={{ fontFamily: "sans-serif", padding: "3rem", textAlign: "center", maxWidth: "600px", margin: "0 auto" }}>
      <h1>🎉 Welcome to DropX</h1>
      <p>
        {shopName ? (
          <>Your store <strong>{shopName}</strong> is now connected to DropX.</>
        ) : (
          <>Your Shopify store is now connected to DropX.</>
        )}
      </p>
      <p>
        DropX helps you build a powerful dropshipping business with curated products and fast local fulfillment in Egypt.
      </p>

      <button
        disabled={!isReady || loading}
        style={{
          marginTop: "2rem",
          padding: "1rem 2rem",
          fontSize: "1.2rem",
          backgroundColor: "#000",
          color: "#fff",
          border: "none",
          borderRadius: "4px",
          cursor: isReady ? "pointer" : "not-allowed",
          opacity: isReady ? 1 : 0.6,
        }}
        onClick={() => {
          window.location.href = "https://drop-x.co/products";
        }}
      >
        {loading ? "Checking..." : isReady ? "Start Exploring" : "Finishing Setup..."}
      </button>
    </main>
  );
}