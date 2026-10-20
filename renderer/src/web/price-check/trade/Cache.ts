import hash from "object-hash";

export const CACHE_TTL = 300;

interface Entry {
  value: unknown;
  timer: ReturnType<typeof setTimeout>;
}

function keyOf(key: unknown): string {
  return hash.sha1(JSON.parse(JSON.stringify(key)));
}

export class Cache {
  private cached = new Map<string, Entry>();
  private currency = "";

  get<T = unknown>(key: unknown): T | undefined {
    return this.cached.get(keyOf(key))?.value as T | undefined;
  }

  /** Stores the value for `ttl` seconds, counted from this write. */
  set<T = unknown>(key: unknown, value: T, ttl = CACHE_TTL): void {
    const _key = keyOf(key);
    clearTimeout(this.cached.get(_key)?.timer);

    const timer = setTimeout(() => {
      this.cached.delete(_key);
    }, ttl * 1000);
    this.cached.set(_key, { value, timer });
  }

  purgeIfDifferentCurrency(currency: string | undefined) {
    if (!currency || this.currency === currency) return;
    this.currency = currency;
    for (const entry of this.cached.values()) clearTimeout(entry.timer);
    this.cached.clear();
  }
}
