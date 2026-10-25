/**
 * Very short in-process cache for expensive read-only API aggregates.
 *
 * Concurrent callers share the same pending computation. Values are retained
 * only for a few seconds; failures are never cached. This is an optimization
 * for read endpoints, not a replacement for the MikroTik synchronizer.
 */
type CacheEntry = {
  expiresAt: number;
  value?: unknown;
  pending?: Promise<unknown>;
};

const entries = new Map<string, CacheEntry>();

export async function withShortCache<T>(
  key: string,
  ttlMs: number,
  load: () => Promise<T>
): Promise<T> {
  const now = Date.now();
  const existing = entries.get(key) as CacheEntry | undefined;

  if (existing?.pending) {
    return existing.pending as Promise<T>;
  }

  if (existing && existing.expiresAt > now && "value" in existing) {
    return existing.value as T;
  }

  const pending = load();
  entries.set(key, { expiresAt: now + ttlMs, pending });

  try {
    const value = await pending;
    entries.set(key, { expiresAt: Date.now() + ttlMs, value });
    return value;
  } catch (error) {
    if (entries.get(key)?.pending === pending) {
      entries.delete(key);
    }
    throw error;
  }
}
