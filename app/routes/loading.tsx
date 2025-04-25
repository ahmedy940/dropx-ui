import { MetaFunction } from "@remix-run/node";

export const meta: MetaFunction = () => {
  return [{ title: "DropX | Loading" }];
};

export default function Loading() {
  return (
    <main style={{ padding: "3rem", textAlign: "center", fontFamily: "sans-serif" }}>
      <h2>⏳ Just a moment...</h2>
      <p>We're preparing your store, syncing data, or redirecting you.</p>
      <p>Please do not close this tab.</p>
    </main>
  );
}