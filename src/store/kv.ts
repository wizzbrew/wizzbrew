import { Redis } from "@upstash/redis";
import { config } from "../config.js";

export interface Kv {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSec?: number): Promise<void>;
  del(key: string): Promise<void>;
  incrByFloat(key: string, by: number, ttlSec?: number): Promise<number>;
  expire(key: string, ttlSec: number): Promise<void>;
}

let instance: Kv | null = null;

// Maps the Kv interface onto the Upstash REST client. Upstash errors propagate unchanged.
function upstash(redis: Redis): Kv {
  return {
    async get<T>(key: string): Promise<T | null> {
      return redis.get<T>(key);
    },
    async set<T>(key: string, value: T, ttlSec?: number): Promise<void> {
      if (ttlSec === undefined) {
        await redis.set(key, value);
      } else {
        await redis.set(key, value, { ex: ttlSec });
      }
    },
    async del(key: string): Promise<void> {
      await redis.del(key);
    },
    async incrByFloat(key: string, by: number, ttlSec?: number): Promise<number> {
      const value = Number(await redis.incrbyfloat(key, by));
      if (ttlSec !== undefined) {
        await redis.expire(key, ttlSec);
      }
      return value;
    },
    async expire(key: string, ttlSec: number): Promise<void> {
      await redis.expire(key, ttlSec);
    },
  };
}

export function kv(): Kv {
  if (instance === null) {
    const { kvRestApiUrl, kvRestApiToken } = config();
    instance = upstash(new Redis({ url: kvRestApiUrl, token: kvRestApiToken }));
  }
  return instance;
}

export function setKvForTests(k: Kv | null): void {
  instance = k;
}
