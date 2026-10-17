import { randomBytes } from "node:crypto";
import { createServer } from "node:http";
import { configFor } from "../src/config.js";
import { discoverMetadata, exchangeCode, pkcePair } from "../src/wizzrobe/oauth.js";

// One-time local OAuth for the bot's own read-only account. Prints its refresh token once;
// the operator stores it as WIZZROBE_BOT_REFRESH_TOKEN. Register the redirect URI below with
// the OAuth client first.
const HOST = "127.0.0.1";
const PORT = 8976;
const REDIRECT_URI = `http://${HOST}:${PORT}/callback`;
const SCOPE = "wizzrobe:read";
const WAIT_MS = 5 * 60 * 1000;

// Resolves with the authorization code from the first /callback request that carries the
// expected state. A callback with any other state is answered 410 and ignored.
function waitForCode(expectedState: string, authorizeUrl: string): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url ?? "/", `http://${HOST}:${PORT}`);
      if (url.pathname !== "/callback") {
        res.writeHead(404, { connection: "close" }).end();
        return;
      }
      const finish = (status: number, text: string, outcome: () => void): void => {
        res.writeHead(status, { "content-type": "text/plain", connection: "close" }).end(text);
        clearTimeout(timer);
        server.close();
        server.closeAllConnections();
        outcome();
      };
      const code = url.searchParams.get("code");
      const denied = url.searchParams.get("error");
      if (url.searchParams.get("state") !== expectedState) {
        // A stale tab reloading (an earlier run's link) is not the callback we are waiting for.
        // Answer it and keep listening until the right one arrives or the timeout fires.
        res
          .writeHead(410, { "content-type": "text/plain", connection: "close" })
          .end("Old link. Close this tab.");
      } else if (denied !== null || code === null || code === "") {
        finish(400, "Authorization failed. Close this tab.", () =>
          reject(new Error(`Authorization failed${denied === null ? "" : `: ${denied}`}`)),
        );
      } else {
        finish(200, "Done. You can close this tab and return to the terminal.", () =>
          resolve(code),
        );
      }
    });
    const timer = setTimeout(() => {
      server.close();
      server.closeAllConnections();
      reject(new Error("Timed out waiting for the callback"));
    }, WAIT_MS);
    server.once("error", (err) => {
      clearTimeout(timer);
      reject(new Error(`Could not listen on ${HOST}:${PORT}: ${err.message}`));
    });
    server.listen(PORT, HOST, () => {
      console.log("Open this URL and approve access as the bot account:");
      console.log(authorizeUrl);
    });
  });
}

try {
  const cfg = configFor(
    "wizzrobeBaseUrl",
    "wizzrobeMcpUrl",
    "wizzrobeOauthClientId",
    "wizzrobeOauthClientSecret",
  );
  const meta = await discoverMetadata();
  const { verifier, challenge } = pkcePair();
  const state = randomBytes(16).toString("base64url");
  const url = new URL(meta.authorization_endpoint);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", cfg.wizzrobeOauthClientId);
  url.searchParams.set("redirect_uri", REDIRECT_URI);
  url.searchParams.set("scope", SCOPE);
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("resource", cfg.wizzrobeMcpUrl);

  const code = await waitForCode(state, url.toString());
  const grant = await exchangeCode(code, verifier, REDIRECT_URI);
  if (grant.refreshToken === undefined) throw new Error("Wizzrobe sent no refresh token");
  console.log("Put this value in WIZZROBE_BOT_REFRESH_TOKEN. It is shown once:");
  console.log(grant.refreshToken);
} catch (err) {
  const message = err instanceof Error ? err.message : "unknown error";
  console.error(`Wizzrobe login failed: ${message}`);
  process.exitCode = 1;
}
