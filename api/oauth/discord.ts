import { UserInputError } from "../../src/errors.js";
import { log } from "../../src/log.js";
import { verifyDiscord } from "../../src/wizzrobe/oauth.js";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function page(status: number, message: string): Response {
  const body = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Wizzbrew</title></head><body><p>${escapeHtml(message)}</p></body></html>`;
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
}

export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;
  if (params.get("error")) return page(400, "Linking was cancelled. You can close this tab.");
  const code = params.get("code");
  const state = params.get("state");
  if (!code || !state) {
    return page(400, "This link is incomplete. Ask Wizzbrew to link you again.");
  }
  try {
    const { redirectTo } = await verifyDiscord(code, state);
    return new Response(null, {
      status: 302,
      headers: {
        Location: redirectTo,
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch (err) {
    if (err instanceof UserInputError) return page(400, err.message);
    log("error", "oauth.discord_failed", {
      error: err instanceof Error ? err.name : "unknown",
    });
    return page(500, "Something went wrong. Ask Wizzbrew to link you again.");
  }
}
