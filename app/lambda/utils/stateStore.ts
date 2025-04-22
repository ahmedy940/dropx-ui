


type StateEntry = {
  value: string;
  expiresAt: number;
};

const stateStore: Map<string, StateEntry> = new Map();

/**
 * Stores a temporary OAuth state for a given shop, valid for a limited time.
 */
export function storeOAuthState(shop: string, state: string, ttlMs = 5 * 60 * 1000): void {
  const expiresAt = Date.now() + ttlMs;
  stateStore.set(shop, { value: state, expiresAt });
  console.log(`[StateStore] Stored state for ${shop}: ${state}`);
}

/**
 * Retrieves the stored OAuth state for a shop, if valid.
 */
export function getOAuthState(shop: string): string | null {
  const entry = stateStore.get(shop);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    console.warn(`[StateStore] OAuth state expired for ${shop}`);
    stateStore.delete(shop);
    return null;
  }
  return entry.value;
}