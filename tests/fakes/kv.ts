import type { Kv } from "../../src/store/kv.js";

interface Entry {
  value: unknown;
  expiresAt: number | null;
}

// In-memory Kv. Values round-trip through structuredClone like Upstash's JSON.
export class FakeKv implements Kv {
  private readonly store = new Map<string, Entry>();
  private readonly clock: () => number;

  // clock returns epoch ms; TTLs expire against it
  constructor(clock: () => number = Date.now) {
    this.clock = clock;
  }

  // The live entry for key, or undefined. An expired entry is deleted on sight.
  private live(key: string): Entry | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt !== null && entry.expiresAt <= this.clock()) {
      this.store.delete(key);
      return undefined;
    }
    return entry;
  }

  private expiryFor(ttlSec: number): number {
    return this.clock() + ttlSec * 1000;
  }

  async get<T>(key: string): Promise<T | null> {
    const entry = this.live(key);
    if (!entry) return null;
    return structuredClone(entry.value) as T;
  }

  async set<T>(key: string, value: T, ttlSec?: number): Promise<void> {
    this.store.set(key, {
      value: structuredClone(value),
      expiresAt: ttlSec === undefined ? null : this.expiryFor(ttlSec),
    });
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }

  async incrByFloat(key: string, by: number, ttlSec?: number): Promise<number> {
    const entry = this.live(key);
    const current = typeof entry?.value === "number" ? entry.value : 0;
    const next = current + by;
    const expiresAt = ttlSec === undefined ? (entry?.expiresAt ?? null) : this.expiryFor(ttlSec);
    this.store.set(key, { value: next, expiresAt });
    return next;
  }

  async expire(key: string, ttlSec: number): Promise<void> {
    const entry = this.live(key);
    if (!entry) return;
    entry.expiresAt = this.expiryFor(ttlSec);
  }

  async take<T>(key: string): Promise<T | null> {
    const entry = this.live(key);
    if (!entry) return null;
    this.store.delete(key);
    return structuredClone(entry.value) as T;
  }

  async setIfAbsent<T>(key: string, value: T, ttlSec: number): Promise<boolean> {
    if (this.live(key)) return false;
    this.store.set(key, { value: structuredClone(value), expiresAt: this.expiryFor(ttlSec) });
    return true;
  }

  async rpush(key: string, value: string, ttlSec?: number): Promise<number> {
    const entry = this.live(key);
    const list = Array.isArray(entry?.value) ? (entry.value as unknown[]) : [];
    list.push(structuredClone(value));
    const expiresAt = ttlSec === undefined ? (entry?.expiresAt ?? null) : this.expiryFor(ttlSec);
    this.store.set(key, { value: list, expiresAt });
    return list.length;
  }

  // Same index rules as Redis: negative counts from the end, stop is inclusive.
  async lrange(key: string, start: number, stop: number): Promise<unknown[]> {
    const entry = this.live(key);
    if (!Array.isArray(entry?.value)) return [];
    const list = entry.value as unknown[];
    const from = Math.max(start < 0 ? list.length + start : start, 0);
    const to = Math.min(stop < 0 ? list.length + stop : stop, list.length - 1);
    return structuredClone(list.slice(from, to + 1));
  }

  async hincrby(key: string, field: string, by: number, ttlSec?: number): Promise<number> {
    const entry = this.live(key);
    const hash: Record<string, number> =
      entry?.value !== null && typeof entry?.value === "object" && !Array.isArray(entry.value)
        ? (entry.value as Record<string, number>)
        : {};
    const next = (hash[field] ?? 0) + by;
    hash[field] = next;
    const expiresAt = ttlSec === undefined ? (entry?.expiresAt ?? null) : this.expiryFor(ttlSec);
    this.store.set(key, { value: hash, expiresAt });
    return next;
  }

  async hget(key: string, field: string): Promise<unknown> {
    const entry = this.live(key);
    if (entry?.value === null || typeof entry?.value !== "object" || Array.isArray(entry.value)) {
      return null;
    }
    const hash = entry.value as Record<string, unknown>;
    return field in hash ? structuredClone(hash[field]) : null;
  }

  async hgetall(key: string): Promise<Record<string, unknown>> {
    const entry = this.live(key);
    if (entry?.value === null || typeof entry?.value !== "object" || Array.isArray(entry.value)) {
      return {};
    }
    return structuredClone(entry.value) as Record<string, unknown>;
  }

  // The seconds left before key expires, or null when it has no expiry or is gone. For tests.
  ttlSec(key: string): number | null {
    const entry = this.live(key);
    if (!entry || entry.expiresAt === null) return null;
    return Math.round((entry.expiresAt - this.clock()) / 1000);
  }

  // present and not expired
  has(key: string): boolean {
    return this.live(key) !== undefined;
  }

  // live keys
  keys(): string[] {
    return [...this.store.keys()].filter((key) => this.live(key) !== undefined);
  }
}
