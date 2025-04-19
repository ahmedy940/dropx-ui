import { useEffect, useState } from "react";
import { json, type LoaderFunction } from "@remix-run/node";
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

  return json({ products });
};

export default function Dashboard() {
  const { products } = useLoaderData<typeof loader>();

  return (
    <div style={{ padding: "2rem" }}>
      <h1>📦 DropX Product Dashboard</h1>
      <p>Manage your synced products below.</p>
      <table style={{ width: "100%", marginTop: "1rem", borderCollapse: "collapse" }}>
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
              <td style={{ padding: "0.5rem" }}>{product.status}</td>
              <td style={{ padding: "0.5rem" }}>
                {product.synced ? "✅" : "❌"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
