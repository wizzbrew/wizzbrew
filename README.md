# Wizzbrew

A Discord bot for SpeedGaming Live 2026. Ask it about the schedule, streams, standings and
players, or how things work. It answers from [Wizzrobe](https://onsite.speedgaming.org), the
event's onsite tool. Link your Wizzrobe account and it can also do a few things for you: sign you
up as crew, acknowledge a match, offer a match for stream.

## How people talk to it

- **Mentions.** @mention the bot in an allowed channel and ask in plain words.
- **Replies.** Reply to one of its messages to follow up. Anyone can follow up on a public answer.
- **DMs.** Message it directly; it answers there.
- **Slash commands.** `/ask`, `/schedule`, `/live`, `/standings`, `/player`, `/link`, `/unlink`,
  `/me`.
- **Buttons.** Anything that changes your data shows a Confirm and Cancel button first. Only the
  person who asked can press them, and the action runs with their own Wizzrobe token. Answers can
  also offer choices (for example when a name matches several players) and "Change something".
- **Follow-ups.** The responder sees the earlier turns, so you can keep going in a reply chain.
- **Private answers.** Anything about one person (`/me`, linked actions) is ephemeral. On the
  message path, "Show me privately" moves a personal answer out of the channel. Only schedule,
  stream and standings answers post publicly.
- **Casual chat.** Chat has A Link to the Past and randomizer reference knowledge from
  `prompts/alttp-game-knowledge.md`. After editing it, rebuild the prompt constant with
  `npm run build:knowledge`; the unit tests fail until you do.

## Architecture

A Vercel app (TypeScript, plain API routes) receives Discord HTTP interactions (slash commands,
buttons, modals) and the OAuth callback. A small discord.js relay on Railway holds the gateway
connection and forwards mentions, DMs and replies, with the reply chain, to the signed
`/api/message` endpoint on Vercel, which posts the answer itself. Each request goes through a
Claude Haiku router, a code permission check, then a Claude Sonnet responder that reads Wizzrobe
through the MCP connector on the Messages API. Writes are called directly over MCP after a
Confirm. Upstash Redis holds linked accounts, cache, conversation state, the spend counter and
the kill switch. Bracket answers give the bracket and rules links; live standings are in
[docs/backlog.md](docs/backlog.md). See [plan.md](plan.md); deploying starts at
[docs/handoff-deploy.md](docs/handoff-deploy.md).

## Local dev

```
npm ci
npm run check     # typecheck, Biome, vitest, scripts/check-rules.ts
npm run eval      # the eval suite
```

Copy `.env.example` to `.env.local` for local runs. Only names are in the tree; real values never
are. `npm run register` registers the slash commands.

## Docs

- [plan.md](plan.md): architecture, routes, open questions, status.
- [docs/deploy-checklist.md](docs/deploy-checklist.md): every deploy step, account and env var.
- [docs/build.md](docs/build.md): how the build runs.
- [docs/contracts.md](docs/contracts.md): layout, types and module signatures.
- [docs/tasks.md](docs/tasks.md): the task DAG.
- [docs/lessons.md](docs/lessons.md): failure modes as rules with tests.
- [docs/wizzrobe-surface.md](docs/wizzrobe-surface.md): every Wizzrobe tool and who may call it.
- [relay/README.md](relay/README.md): the Railway relay.
