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

  // present and not expired
  has(key: string): boolean {
    return this.live(key) !== undefined;
  }

  // live keys
  keys(): string[] {
    return [...this.store.keys()].filter((key) => this.live(key) !== undefined);
  }
}
