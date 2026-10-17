import { Redis } from "@upstash/redis";
import { config } from "../config.js";

export interface Kv {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSec?: number): Promise<void>;
  del(key: string): Promise<void>;
  incrByFloat(key: string, by: number, ttlSec?: number): Promise<number>;
  expire(key: string, ttlSec: number): Promise<void>;
  take<T>(key: string): Promise<T | null>; // atomic get and delete (GETDEL)
  setIfAbsent<T>(key: string, value: T, ttlSec: number): Promise<boolean>; // SET NX EX; true when set
  rpush(key: string, value: string, ttlSec?: number): Promise<number>; // RPUSH then EXPIRE when ttlSec is given; returns the new length
  lrange(key: string, start: number, stop: number): Promise<unknown[]>; // LRANGE, negative indexes count from the end; items may arrive already JSON-parsed
  hincrby(key: string, field: string, by: number, ttlSec?: number): Promise<number>; // HINCRBY then EXPIRE when ttlSec is given; returns the new value
  hget(key: string, field: string): Promise<unknown>; // HGET; null when the key or field is absent
  hgetall(key: string): Promise<Record<string, unknown>>; // HGETALL; empty when the key is absent
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
    async take<T>(key: string): Promise<T | null> {
      return redis.getdel<T>(key);
    },
    async setIfAbsent<T>(key: string, value: T, ttlSec: number): Promise<boolean> {
      const result = await redis.set(key, value, { nx: true, ex: ttlSec });
      return result === "OK";
    },
    async rpush(key: string, value: string, ttlSec?: number): Promise<number> {
      const length = await redis.rpush(key, value);
      if (ttlSec !== undefined) {
        await redis.expire(key, ttlSec);
      }
      return length;
    },
    async lrange(key: string, start: number, stop: number): Promise<unknown[]> {
      return redis.lrange<unknown>(key, start, stop);
    },
    async hincrby(key: string, field: string, by: number, ttlSec?: number): Promise<number> {
      const value = await redis.hincrby(key, field, by);
      if (ttlSec !== undefined) {
        await redis.expire(key, ttlSec);
      }
      return value;
    },
    async hget(key: string, field: string): Promise<unknown> {
      return redis.hget<unknown>(key, field);
    },
    async hgetall(key: string): Promise<Record<string, unknown>> {
      return (await redis.hgetall<Record<string, unknown>>(key)) ?? {};
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
