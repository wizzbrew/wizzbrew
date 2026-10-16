import { NotImplemented } from "../../src/errors.js";

export class FakeChallonge {
  readonly requests: string[] = []; // URLs fetched

  // serves tests/fixtures/challonge/*.json
  readonly fetch: typeof fetch = async () => {
    throw new NotImplemented("FakeChallonge.fetch");
  };

  // every later request answers this status
  fail(_status: number): void {
    throw new NotImplemented("FakeChallonge.fail");
  }
}
