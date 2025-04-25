import { useSearchParams } from "@remix-run/react";
import { useEffect, useState } from "react";

export default function RegisterRedirect() {
  const [searchParams] = useSearchParams();
  const email = searchParams.get("email") || "";
  const shop = searchParams.get("shop") || "";
  const shopName = searchParams.get("shopName") || "";

  const [registrationComplete, setRegistrationComplete] = useState(false);
  const [checking, setChecking] = useState(false);

  const handleContinue = async () => {
    try {
      setChecking(true);
      const postInstallEndpoint = "https://app.drop-x.co/post-install"; // using SSM param value here
      const res = await fetch(postInstallEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ shop, email }),
      });

      const result = await res.json();

      if (result?.needsRegistration) {
        setChecking(false);
        alert("Registration still required. Please complete the registration before continuing.");
      } else {
        setRegistrationComplete(true);
        window.location.href = `/post-install?email=${encodeURIComponent(email)}&shop=${encodeURIComponent(shop)}&shopName=${encodeURIComponent(shopName)}`;
      }
    } catch (error) {
      console.error("[ERROR] Sync check failed:", error);
      alert("An error occurred while verifying registration. Please try again.");
    }
  };

  return (
    <div style={{ padding: "2rem", textAlign: "center", fontFamily: "sans-serif" }}>
      {!registrationComplete ? (
        <>
          <h1>🔐 Registration Required</h1>
          <p>To sync your store <strong>{shopName || shop}</strong> with DropX, you must first create an account.</p>
          <a
            href="https://drop-x.co/account/register"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-block",
              margin: "1rem 0",
              padding: "0.75rem 1.5rem",
              backgroundColor: "#000",
              color: "#fff",
              textDecoration: "none",
              borderRadius: "5px"
            }}
          >
            Register on DropX
          </a>
          <p>Once you're done, click the button below to continue.</p>
          {checking ? (
            <p>🔄 Verifying your registration...</p>
          ) : (
            <button
              onClick={handleContinue}
              style={{
                marginTop: "1rem",
                padding: "0.75rem 1.5rem",
                fontSize: "1rem",
                borderRadius: "5px",
                border: "none",
                backgroundColor: "#0070f3",
                color: "#fff",
                cursor: "pointer"
              }}
            >
              ✅ I've Registered, Continue
            </button>
          )}
        </>
      ) : (
        <h2>✅ You're already synced with DropX!</h2>
      )}
    </div>
  );
}
