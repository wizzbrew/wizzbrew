import { beforeAll, describe, expect, it } from "vitest";
import { verifyDiscordRequest } from "../../src/discord/verify.js";

interface Signer {
  publicKeyHex: string;
  sign(timestamp: string, body: string): Promise<string>;
}

async function makeSigner(): Promise<Signer> {
  const generated: unknown = await crypto.subtle.generateKey({ name: "Ed25519" }, true, [
    "sign",
    "verify",
  ]);
  const pair = generated as { publicKey: CryptoKey; privateKey: CryptoKey };
  const raw = await crypto.subtle.exportKey("raw", pair.publicKey);
  return {
    publicKeyHex: Buffer.from(raw).toString("hex"),
    async sign(timestamp, body) {
      const sig = await crypto.subtle.sign(
        "Ed25519",
        pair.privateKey,
        new TextEncoder().encode(timestamp + body),
      );
      return Buffer.from(sig).toString("hex");
    },
  };
}

describe("verifyDiscordRequest", () => {
  let signer: Signer;
  let other: Signer;
  const timestamp = "1760000000";
  const body = JSON.stringify({ type: 1 });

  beforeAll(async () => {
    signer = await makeSigner();
    other = await makeSigner();
  });

  it("accepts a correctly signed request", async () => {
    const signature = await signer.sign(timestamp, body);
    expect(await verifyDiscordRequest(body, signature, timestamp, signer.publicKeyHex)).toBe(true);
  });

  it("rejects a tampered body", async () => {
    const signature = await signer.sign(timestamp, body);
    const tampered = JSON.stringify({ type: 2 });
    expect(await verifyDiscordRequest(tampered, signature, timestamp, signer.publicKeyHex)).toBe(
      false,
    );
  });

  it("rejects a tampered timestamp", async () => {
    const signature = await signer.sign(timestamp, body);
    expect(await verifyDiscordRequest(body, signature, "1760000001", signer.publicKeyHex)).toBe(
      false,
    );
  });

  it("rejects a signature made by another key", async () => {
    const signature = await other.sign(timestamp, body);
    expect(await verifyDiscordRequest(body, signature, timestamp, signer.publicKeyHex)).toBe(false);
  });

  it("returns false for a malformed hex signature without throwing", async () => {
    expect(await verifyDiscordRequest(body, "not-hex-at-all", timestamp, signer.publicKeyHex)).toBe(
      false,
    );
    expect(await verifyDiscordRequest(body, "abc", timestamp, signer.publicKeyHex)).toBe(false);
  });

  it("returns false for a malformed public key without throwing", async () => {
    const signature = await signer.sign(timestamp, body);
    expect(await verifyDiscordRequest(body, signature, timestamp, "zz")).toBe(false);
  });

  it("returns false for empty strings", async () => {
    expect(await verifyDiscordRequest("", "", "", "")).toBe(false);
    const signature = await signer.sign(timestamp, body);
    expect(await verifyDiscordRequest(body, signature, "", signer.publicKeyHex)).toBe(false);
    expect(await verifyDiscordRequest(body, "", timestamp, signer.publicKeyHex)).toBe(false);
    expect(await verifyDiscordRequest(body, signature, timestamp, "")).toBe(false);
  });
});
