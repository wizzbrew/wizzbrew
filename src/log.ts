const REDACT = /token|secret|authorization|password|api_?key|refresh/i;

export function clip(text: string, max = 200): string {
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

function scrub(value: unknown, depth: number): unknown {
  if (typeof value === "string") return clip(value);
  if (value === null || typeof value !== "object") return value;
  if (depth > 8) return "[too deep]";
  if (value instanceof Error) return { name: value.name, message: clip(value.message) };
  if (Array.isArray(value)) return value.map((v) => scrub(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    out[k] = REDACT.test(k) ? "[redacted]" : scrub(v, depth + 1);
  }
  return out;
}

// One JSON line: {ts, level, event, ...fields}. Error level goes to stderr (L24).
export function log(
  level: "info" | "warn" | "error",
  event: string,
  fields: Record<string, unknown> = {},
): void {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    event,
    ...(scrub(fields, 0) as Record<string, unknown>),
  });
  if (level === "error") console.error(line);
  else console.log(line);
}
