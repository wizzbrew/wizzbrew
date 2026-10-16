import { checkConfig } from "../src/config.js";
import { ROUTES } from "../src/router/routes.js";

export async function GET(_request: Request): Promise<Response> {
  return Response.json(
    { ok: true, configValid: checkConfig().valid, routes: Object.keys(ROUTES) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
