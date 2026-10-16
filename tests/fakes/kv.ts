import { NotImplemented } from "../../src/errors.js";
import type { Kv } from "../../src/store/kv.js";

export class FakeKv implements Kv {
  // clock returns epoch ms; TTLs expire against it
  constructor(_clock?: () => number) {
    throw new NotImplemented("FakeKv.constructor");
  }

  async get<T>(_key: string): Promise<T | null> {
    throw new NotImplemented("FakeKv.get");
  }

  async set<T>(_key: string, _value: T, _ttlSec?: number): Promise<void> {
    throw new NotImplemented("FakeKv.set");
  }

  async del(_key: string): Promise<void> {
    throw new NotImplemented("FakeKv.del");
  }

  async incrByFloat(_key: string, _by: number, _ttlSec?: number): Promise<number> {
    throw new NotImplemented("FakeKv.incrByFloat");
  }

  async expire(_key: string, _ttlSec: number): Promise<void> {
    throw new NotImplemented("FakeKv.expire");
  }

  has(_key: string): boolean {
    throw new NotImplemented("FakeKv.has");
  }

  keys(): string[] {
    throw new NotImplemented("FakeKv.keys");
  }
}
