import { NotImplemented } from "../errors.js";

export async function verifyDiscordRequest(
  _rawBody: string,
  _signature: string,
  _timestamp: string,
  _publicKey: string,
): Promise<boolean> {
  throw new NotImplemented("verify.verifyDiscordRequest");
}
