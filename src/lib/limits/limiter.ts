// A tiny counter store behind the rate limit and provider budgets.
// Upstash Redis in production; in-memory (per server instance) when Upstash isn't configured.
import { Redis } from "@upstash/redis";

export interface Store {
  /** Atomically increments and returns the new value; sets the TTL when the key is new. */
  incr(key: string, ttlSec: number): Promise<number>;
  get(key: string): Promise<number>;
  set(key: string, value: number, ttlSec: number): Promise<void>;
  readonly kind: "upstash" | "memory";
  readonly redis?: Redis;
}

const TIMEOUT_MS = 1_000;

export function memoryStore(now: () => number = Date.now): Store {
  const data = new Map<string, { value: number; expires: number }>();
  const live = (key: string) => {
    const entry = data.get(key);
    if (entry && entry.expires <= now()) data.delete(key);
    return data.get(key);
  };
  return {
    kind: "memory",
    async incr(key, ttlSec) {
      const entry = live(key);
      if (entry) return ++entry.value;
      data.set(key, { value: 1, expires: now() + ttlSec * 1000 });
      return 1;
    },
    async get(key) {
      return live(key)?.value ?? 0;
    },
    async set(key, value, ttlSec) {
      data.set(key, { value, expires: now() + ttlSec * 1000 });
    },
  };
}

export function upstashStore(url: string, token: string): Store {
  const redis = new Redis({ url, token, retry: false });
  return {
    kind: "upstash",
    redis,
    async incr(key, ttlSec) {
      const [value] = await redis.pipeline().incr(key).expire(key, ttlSec, "NX").exec<[number, number]>();
      return value;
    },
    async get(key) {
      return Number((await redis.get<number>(key)) ?? 0);
    },
    async set(key, value, ttlSec) {
      await redis.set(key, value, { ex: ttlSec });
    },
  };
}

const cache = globalThis as unknown as { __cwStore?: Store };

export function getStore(): Store {
  if (!cache.__cwStore) {
    const { UPSTASH_REDIS_REST_URL: url, UPSTASH_REDIS_REST_TOKEN: token } = process.env;
    if (url && token) {
      cache.__cwStore = upstashStore(url, token);
    } else {
      console.warn("[limits] UPSTASH_REDIS_REST_URL/TOKEN not set: using an in-memory store (limits are per server instance)");
      cache.__cwStore = memoryStore();
    }
  }
  return cache.__cwStore;
}

/** Limits must never take the site down: on error or after 1 s, use the fallback and warn. */
export function failOpen<T>(p: Promise<T>, fallback: T, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((resolve) => {
    timer = setTimeout(() => {
      console.warn(`[limits] ${label} timed out; failing open`);
      resolve(fallback);
    }, TIMEOUT_MS);
  });
  const guarded = p.catch((err: unknown) => {
    console.warn(`[limits] ${label} failed (${err instanceof Error ? err.message : String(err)}); failing open`);
    return fallback;
  });
  return Promise.race([guarded, timeout]).finally(() => clearTimeout(timer));
}
