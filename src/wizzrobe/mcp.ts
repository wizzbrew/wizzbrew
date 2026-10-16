import { NotImplemented } from "../errors.js";

export function connectorParams(
  _token: string,
  _readTools: string[],
): { mcp_servers: unknown[]; tools: unknown[]; betas: string[] } {
  throw new NotImplemented("mcp.connectorParams");
}

export async function callTool(
  _token: string,
  _name: string,
  _args: Record<string, unknown>,
): Promise<unknown> {
  throw new NotImplemented("mcp.callTool");
}

export interface RawToolResult {
  isError: boolean;
  text: string;
}

export type RawToolCall = (
  token: string,
  name: string,
  args: Record<string, unknown>,
) => Promise<RawToolResult>;

export function setRawToolCallForTests(_f: RawToolCall | null): void {
  throw new NotImplemented("mcp.setRawToolCallForTests");
}
