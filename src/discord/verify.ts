import { verifyKey } from "discord-interactions";

// Ed25519 check of a Discord interaction. Returns false for anything empty, malformed or
// rejected; it never throws and never logs, so a bad request just fails verification.
export async function verifyDiscordRequest(
  rawBody: string,
  signature: string,
  timestamp: string,
  publicKey: string,
): Promise<boolean> {
  if (!rawBody || !signature || !timestamp || !publicKey) return false;
  try {
    return (await verifyKey(rawBody, signature, timestamp, publicKey)) === true;
  } catch {
    return false;
  }
}
