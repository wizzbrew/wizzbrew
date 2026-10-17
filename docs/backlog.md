# Backlog

Work that is parked, with why and what would bring it back. Newest first.

## Brackets: read them from Wizzrobe, retire the Challonge client (parked 2026-10-16)

**Decision (Vince, 2026-10-16):** Wizzbrew will most likely read brackets from Wizzrobe instead of
calling Challonge itself. The Challonge API work is parked here. Deploy without
`CHALLONGE_API_KEY`.

**What happens with no key:** `bracketFor` in `src/challonge/challonge.ts` returns
`source: "link_only"`, and the brackets and `me` responders give the bracket link and rules link
and say live standings aren't available. No code change is needed to ship this way.

**State of Wizzrobe on 2026-10-16** (checked over MCP as `homemadebeer`):

- `sgl26` has the `challonge` feature on, and tournaments carry `challonge_tournament_url`.
- Linked to Challonge (10): ALttP NMG (7, `sgl26nmg`), ALttP Hybrid MG (8, `sgl26hybrid`),
  ALttP Randomizer (9, `sgl26alttpr`), DK64R (10, `sgl26dk64r`), FF Randomizer (11,
  `sgl2026ffrlive`), SM Any% (14, `sgl26smany`), SM Map Rando (15, `sgl26smmap`), SM DASH (16,
  `sgl26smdash`), Z1R (17, `sgl26z1r`), WWR (18, `sgl26wwr`).
- Not linked: MMR (12; `bracket_url` is `sgl26mmr` on Challonge but no link), OoTR (13; start.gg),
  Best of NES Relay (19) and High Score (20; no bracket).
- The bracket read tools (`list_brackets`, `get_bracket`, `list_bracket_matches`,
  `get_bracket_standings`, `list_bracket_entrants`) all answer "This feature is not enabled for
  this community". The synced bracket data exists only behind that feature.
- `sync_challonge_tournament` is staff or tournament admin only; linked brackets "also sync on
  their own" (tool description), at an interval we don't know yet.

**Blocked on (ask Synack):**

1. Turn on the brackets feature for `sgl26` so the bracket read tools answer.
2. How often linked brackets sync on their own, and whether `list_bracket_matches` names the
   feeder match for an undecided slot ("you face the winner of X vs Y").
3. Whether MMR (12) will be linked too.

**The card, once unblocked (one Sonnet card, about 40k):**

- Replace the `challonge_bracket` client tool with the Wizzrobe MCP bracket tools on the
  `brackets` and `me` responders (`src/router/routes.ts`, `src/responders/specs.ts`), reading
  live shapes first and recording fixtures.
- Delete `src/challonge/`, `tests/fakes/challonge.ts`, `tests/fixtures/challonge/`,
  `tests/unit/challonge.test.ts`, and the Challonge cases in the client-tools, specs, routes,
  config, fakes and e2e tests. Remove `CHALLONGE_API_KEY` from `src/config.ts`, `.env.example` and
  the deploy checklist.
- Prompt: keep "a null slot means not decided yet" and "say how fresh it is" if Wizzrobe reports
  a sync time; drop the snapshot and `degraded` wording.
- Update `docs/contracts.md` (BracketSummary, client tools), `docs/wizzrobe-surface.md` (brackets
  feature on) and `plan.md`.
- Tournaments that aren't linked keep the link-only answer.

**If Wizzrobe brackets don't come through:** the Challonge client still works as built (on-demand
snapshot, at most once an hour per tournament, never 00:00 to 08:00 Eastern, ETags). Bringing it
back means a read-only key for `speedgaming.challonge.com` in `CHALLONGE_API_KEY` and a live check
that v2.1 matches carry prerequisite ids. Settle whose key it is first (plan.md open questions).

## Later, from plan.md

- A webhook receiver posting match changes to a channel (needs staff to configure it).
- The staff route: reports, coverage and the live board for linked staff.
