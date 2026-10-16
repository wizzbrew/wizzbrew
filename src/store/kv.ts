import { NotImplemented } from "../errors.js";

export interface Kv {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSec?: number): Promise<void>;
  del(key: string): Promise<void>;
  incrByFloat(key: string, by: number, ttlSec?: number): Promise<number>;
  expire(key: string, ttlSec: number): Promise<void>;
}

export function kv(): Kv {
  throw new NotImplemented("kv.kv");
}

export function setKvForTests(_k: Kv | null): void {
  throw new NotImplemented("kv.setKvForTests");
}
