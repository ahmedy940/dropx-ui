import { useSearchParams } from "@remix-run/react";

export default function ErrorPage() {
  const [searchParams] = useSearchParams();
  const message = searchParams.get("message") || "An unexpected error occurred.";
  const shop = searchParams.get("shop");
  const code = searchParams.get("code");

  return (
    <main style={{ textAlign: "center", marginTop: "50px", fontFamily: "Arial, sans-serif" }}>
      <h1>⚠️ Oops! Something went wrong with DropX</h1>
      <p>{message}</p>
      {shop && <p><strong>Shop:</strong> {shop}</p>}
      {code && <p><strong>Error Code:</strong> {code}</p>}
      <p>If the problem persists, please contact our support or try again later.</p>
      <a
        href="/"
        style={{
          display: "inline-block",
          marginTop: "20px",
          padding: "10px 20px",
          backgroundColor: "#2563EB",
          color: "#fff",
          borderRadius: "4px",
          textDecoration: "none",
          fontWeight: "bold"
        }}
      >
        Back to DropX Home
      </a>
    </main>
  );
}