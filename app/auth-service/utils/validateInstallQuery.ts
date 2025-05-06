import { extractQueryParams } from "../../lambda/utils/queryString";

export function validateInstallQuery(query: Record<string, string | undefined>) {
  const extracted = extractQueryParams(query);
  console.info("[INFO] Extracted query parameters:", extracted);
  if ("error" in extracted) {
    console.warn("[WARN] Error found in query parameters:", extracted.error);
    throw new Error(extracted.error);
  }
  return extracted;
}
