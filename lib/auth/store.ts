/**
 * Key-value storage. Upstash Redis in production (env KV_REST_API_URL/KV_REST_API_TOKEN
 * from the Vercel Marketplace, or UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN).
 * An in-memory map when neither is set, which is what tests use.
 */
import { Redis } from "@upstash/redis";

export interface KV {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, ttlSeconds?: number): Promise<void>;
  del(key: string): Promise<void>;
  /** Atomic read-and-delete; used for every single-use secret. */
  getdel<T>(key: string): Promise<T | null>;
}

class MemoryKV implements KV {
  private map = new Map<string, { value: unknown; expiresAt?: number }>();
  private live(key: string) {
    const entry = this.map.get(key);
    if (!entry) return null;
    if (entry.expiresAt && entry.expiresAt <= Date.now()) {
      this.map.delete(key);
      return null;
    }
    return entry;
  }
  async get<T>(key: string) {
    return (this.live(key)?.value as T | undefined) ?? null;
  }
  async set(key: string, value: unknown, ttlSeconds?: number) {
    this.map.set(key, { value, expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined });
  }
  async del(key: string) {
    this.map.delete(key);
  }
  async getdel<T>(key: string) {
    const value = await this.get<T>(key);
    this.map.delete(key);
    return value;
  }
}

class UpstashKV implements KV {
  constructor(private redis: Redis) {}
  async get<T>(key: string) {
    return (await this.redis.get<T>(key)) ?? null;
  }
  async set(key: string, value: unknown, ttlSeconds?: number) {
    if (ttlSeconds) await this.redis.set(key, value, { ex: ttlSeconds });
    else await this.redis.set(key, value);
  }
  async del(key: string) {
    await this.redis.del(key);
  }
  async getdel<T>(key: string) {
    return (await this.redis.getdel<T>(key)) ?? null;
  }
}

let instance: KV | null = null;

export function kv(): KV {
  if (instance) return instance;
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  instance = url && token ? new UpstashKV(new Redis({ url, token })) : new MemoryKV();
  return instance;
}

/** Tests only: drop the in-memory store between cases. */
export function resetKvForTests(): void {
  instance = null;
}
