REVIEW FIX R2a: link hijack, atomic state, reverse link   model: sonnet   wave: review

BUDGET: Claude Sonnet 5.5, about 60k tokens (card ~2k, READ ~10k, ~350 changed lines). Read only
READ, once. Over 90k or a file outside OWN: report SPLIT. No subagents.

SETUP: `git checkout -B build/r2a build/integration` then `npm ci`.

FINDING (security reviewer, severity high)
Nothing ties the browser that finishes the Wizzrobe login to the Discord user the link was made
for. An attacker runs /link, sends the URL to a victim, the victim logs in, and the victim's
Wizzrobe account is stored under the attacker's Discord id. The state is also read then deleted
(two callbacks can both pass).

READ
- docs/contracts.md "Review fixes" and "wizzrobe/oauth.ts"; src/wizzrobe/oauth.ts,
  api/oauth/callback.ts, src/wizzrobe/identity.ts (saveLink, deleteLink), src/store/keys.ts,
  src/config.ts, tests/setup.ts, .env.example, and their tests

OWN
- src/wizzrobe/oauth.ts, api/oauth/callback.ts, api/oauth/discord.ts (new),
  src/wizzrobe/identity.ts (saveLink, deleteLink and a new reverse lookup only), src/store/keys.ts
  (add `linkOwner(wizzrobeUserId: number)` -> `wb:v1:linkowner:<n>` only), src/config.ts,
  tests/setup.ts, .env.example, and the matching tests (oauth, callback, discord-callback new,
  identity, keys, config)

CHANGES
1. Config: `discordClientSecret` (DISCORD_CLIENT_SECRET, required) and `discordOauthRedirectUri`
   (DISCORD_OAUTH_REDIRECT_URI, https URL). Add to .env.example and tests/setup.ts.
2. startLink(discordUserId): state record `{verifier, discordUserId, discordVerified: false}`
   (600 s); returns the Discord authorize URL `https://discord.com/oauth2/authorize?
   response_type=code&client_id=<discordApplicationId>&scope=identify&redirect_uri=<discordOauthRedirectUri>&state=<state>&prompt=none`.
3. verifyDiscord(code, state): read the state record (missing -> UserInputError "That link
   request expired. Ask me to link you again."); exchange the code at
   `https://discord.com/api/v10/oauth2/token` (form: grant_type=authorization_code, code,
   redirect_uri, client_id, client_secret); GET `https://discord.com/api/v10/users/@me` with the
   access token; its `id` must equal the record's discordUserId, else delete the state and throw
   UserInputError "This link was made for a different Discord account. Ask me to link you from
   your own account." On match: save the record with `discordVerified: true` (same remaining TTL)
   and return `{redirectTo: <the Wizzrobe authorize URL, as startLink built before>}`.
4. api/oauth/discord.ts GET: code, state, error handling like the Wizzrobe callback; success ->
   302 to redirectTo with `Cache-Control: no-store`; errors -> the same escaped HTML pages.
5. finishLink: `kv().take(keys.oauthState(state))` (atomic); missing, or `discordVerified` not
   true -> UserInputError (expired / "Finish the Discord step first"). After whoami: if
   `getLinkOwner(wizzrobeUserId)` exists and differs from discordUserId -> UserInputError "That
   Wizzrobe account is already linked to another Discord account. Unlink it there first."
6. identity.ts: saveLink also sets `keys.linkOwner(rec.wizzrobeUserId)` to the Discord id;
   deleteLink removes it (read the record first); new export `getLinkOwner(wizzrobeUserId):
   Promise<string | null>`. identity.ts stays the only reader of link keys.
7. Tests: the hijack case (Discord id mismatch) refused and nothing saved; verified flow
   succeeds; unverified state refused in finishLink; concurrent finishLink with one state: one
   wins; reverse-key refusal; deleteLink clears the reverse key; no token or code in errors.

DONE WHEN: `npm run typecheck`, `npx vitest run tests/unit`, `npm run lint` and `npm run rules` pass (run `npx vitest run tests/e2e` too and list any e2e failures your intended change causes in DEVIATIONS; do not edit tests/e2e); the perl dash check on your files prints nothing; one commit
on build/r2a "fix(oauth): verify the Discord user before linking" with the trailer
"Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>".

DO NOT: touch files outside OWN; log tokens, codes or state; use `import(`; type a dash.

REPORT (at most 120 words): STATUS, EFFORT, BRANCH/COMMIT, TESTS, DEVIATIONS.
