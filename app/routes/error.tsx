import { useSearchParams } from "@remix-run/react";

export default function ErrorPage() {
  const [searchParams] = useSearchParams();
  const message = searchParams.get("message") || "An unexpected error occurred.";

  return (
    <html lang="en">
      <head>
        <title>Error</title>
      </head>
      <body>
        <div style={{ textAlign: "center", marginTop: "50px" }}>
          <h1>Oops! Something went wrong.</h1>
          <p>{message}</p>
          <a href="/" style={{ textDecoration: "none", color: "blue" }}>
            Return to Home
          </a>
        </div>
      </body>
    </html>
  );
}