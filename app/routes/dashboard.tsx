import { useEffect, useState } from "react";
import { data, type LoaderFunction } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import type { MetaFunction } from "@remix-run/node";

export const meta: MetaFunction = () => {
  return [{ title: "DropX Dashboard" }];
};

type Product = {
  id: string;
  title: string;
  status: string;
  synced: boolean;
};

export const loader: LoaderFunction = async () => {
  // Placeholder: replace with call to your backend or GraphQL endpoint
  const products: Product[] = [
    { id: "1", title: "Red Hoodie", status: "Active", synced: true },
    { id: "2", title: "Blue Sneakers", status: "Inactive", synced: false },
  ];

  return data({ products });
};

export default function Dashboard() {
  useEffect(() => {
    console.info("[INFO] Dashboard page loaded.");
  }, []);

  const { products } = useLoaderData<typeof loader>();

  return (
    <div style={{ padding: "2rem" }}>
      <h1>📦 DropX Product Dashboard</h1>
      <p>Manage your synced products below.</p>
      {products.length === 0 ? (
        <p>No products found. Start by syncing your first product!</p>
      ) : (
        <table aria-label="Product list" style={{ width: "100%", marginTop: "1rem", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ borderBottom: "1px solid #ccc", padding: "0.5rem" }}>Product</th>
              <th style={{ borderBottom: "1px solid #ccc", padding: "0.5rem" }}>Status</th>
              <th style={{ borderBottom: "1px solid #ccc", padding: "0.5rem" }}>Synced</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product: Product) => (
              <tr key={product.id}>
                <td style={{ padding: "0.5rem" }}>{product.title}</td>
                <td style={{ padding: "0.5rem" }}>
                  <span style={{ color: product.status === "Active" ? "green" : "gray" }}>
                    {product.status}
                  </span>
                </td>
                <td style={{ padding: "0.5rem" }}>
                  {product.synced ? "✅" : "❌"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}


export function ErrorBoundary({ error }: { error: Error }) {
  console.error("[ERROR] Dashboard loader failed:", error);
  return (
    <div style={{ padding: "2rem", color: "red" }}>
      <h2>⚠️ Something went wrong</h2>
      <p>{error.message}</p>
    </div>
  );
}