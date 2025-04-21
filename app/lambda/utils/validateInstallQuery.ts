import { extractQueryParams } from "./queryString";

export function validateInstallQuery(query: Record<string, string | undefined>) {
  const extracted = extractQueryParams(query);
  if ("error" in extracted) {
    throw new Error(extracted.error);
  }
  return extracted;
}
