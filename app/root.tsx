import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useRouteError,
} from "@remix-run/react";
import type { MetaFunction, HeadersFunction } from "@remix-run/node";

// Metadata for the app
export const meta: MetaFunction = () => [
  { charset: "utf-8" },
  { title: "DropX" },
  { name: "viewport", content: "width=device-width,initial-scale=1" },
];

// Headers function to include loader and parent headers
export const headers: HeadersFunction = ({ loaderHeaders, parentHeaders }) => ({
  "Content-Type": "text/html",
  ...Object.fromEntries(loaderHeaders),
  ...Object.fromEntries(parentHeaders),
});

// Root application component
export default function App() {
  console.log("[ROOT]: Rendering main application...");

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <link rel="preconnect" href="https://cdn.shopify.com/" />
        <link
          rel="stylesheet"
          href="https://cdn.shopify.com/static/fonts/inter/v4/styles.css"
        />
        <Meta />
        <Links />
      </head>
      <body>
        <main>
          <Outlet />
        </main>
        <footer>
          <p>© {new Date().getFullYear()} DropX. All rights reserved.</p>
        </footer>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

// Global Error Boundary
export function ErrorBoundary({ error }: { error: unknown }) {
  console.error("[ERROR BOUNDARY]: Global error caught:", error);

  const errorMessage =
    error && typeof error === "object" && "message" in error
      ? String((error as Error).message)
      : "An unexpected error occurred.";

  const errorStack =
    process.env.NODE_ENV === "development" && error && typeof error === "object" && "stack" in error
      ? String((error as Error).stack)
      : "No stack trace available.";

  return (
    <html lang="en">
      <head>
        <title>Error</title>
        <Meta />
        <Links />
      </head>
      <body>
        <h1>Application Error</h1>
        <p>{errorMessage}</p>
        {process.env.NODE_ENV === "development" && (
          <pre style={{ whiteSpace: "pre-wrap", color: "red" }}>{errorStack}</pre>
        )}
        <Scripts />
      </body>
    </html>
  );
}

// Catch Boundary for Specific HTTP Errors
export function CatchBoundary() {
  const error = useRouteError();
  console.error("[CATCH BOUNDARY]: Error caught by CatchBoundary:", error);

  const errorMessage =
    error && typeof error === "object" && "message" in error
      ? String((error as Error).message)
      : "An unexpected error occurred. Please try again later.";

  const errorName =
    error && typeof error === "object" && "name" in error
      ? String((error as Error).name)
      : "Error";

  const statusCode =
    error && typeof error === "object" && "status" in error
      ? String((error as { status?: number }).status)
      : "Unknown";

  return (
    <html lang="en">
      <head>
        <title>{errorName}</title>
        <Meta />
        <Links />
      </head>
      <body>
        <h1>{errorName}</h1>
        <p>Status Code: {statusCode}</p>
        <p>{errorMessage}</p>
        <Scripts />
      </body>
    </html>
  );
}