import { config } from "../config.js";

const IV_BYTES = 12;
const INVALID = "sealed value is invalid";
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

// The key is imported once per distinct TOKEN_ENCRYPTION_KEY value and reused after that.
let imported: { material: string; key: CryptoKey } | null = null;

async function aesKey(): Promise<CryptoKey> {
  const material = config().tokenEncryptionKey;
  if (imported !== null && imported.material === material) return imported.key;
  const key = await globalThis.crypto.subtle.importKey(
    "raw",
    Uint8Array.from(Buffer.from(material, "base64")),
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  );
  imported = { material, key };
  return key;
}

export async function seal(plaintext: string): Promise<string> {
  const key = await aesKey();
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ciphertext = await globalThis.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plaintext),
  );
  return `${Buffer.from(iv).toString("base64")}.${Buffer.from(ciphertext).toString("base64")}`;
}

async function decryptParts(sealed: string, key: CryptoKey): Promise<string> {
  const parts = sealed.split(".");
  const [ivPart, bodyPart] = parts;
  if (parts.length !== 2 || !ivPart || !bodyPart) throw new Error(INVALID);
  if (!BASE64.test(ivPart) || !BASE64.test(bodyPart)) throw new Error(INVALID);
  const iv = Uint8Array.from(Buffer.from(ivPart, "base64"));
  if (iv.length !== IV_BYTES) throw new Error(INVALID);
  const body = Uint8Array.from(Buffer.from(bodyPart, "base64"));
  const plaintext = await globalThis.crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, body);
  return new TextDecoder("utf-8", { fatal: true }).decode(plaintext);
}

export async function open(sealed: string): Promise<string> {
  // Key errors are not wrapped, so a bad TOKEN_ENCRYPTION_KEY surfaces as a config error.
  const key = await aesKey();
  try {
    return await decryptParts(sealed, key);
  } catch (cause) {
    throw new Error(INVALID, { cause });
  }
}
