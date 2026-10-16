import { UserInputError, WizzrobeError } from "../../src/errors.js";
import { log } from "../../src/log.js";
import { finishLink } from "../../src/wizzrobe/oauth.js";

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
    await finishLink(code, state);
    return page(200, "Linked. Go back to Discord; I can act for you now. You can close this tab.");
  } catch (err) {
    if (err instanceof UserInputError) return page(400, err.message);
    if (err instanceof WizzrobeError) {
      return page(
        502,
        `Wizzrobe didn't accept the link (${err.detail}). Ask Wizzbrew to link you again.`,
      );
    }
    log("error", "oauth.callback_failed", {
      error: err instanceof Error ? err.name : "unknown",
    });
    return page(500, "Something went wrong. Ask Wizzbrew to link you again.");
  }
}
