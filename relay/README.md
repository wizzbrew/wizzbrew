# Wizzbrew relay

A small always-on gateway process. It watches Discord for messages that @mention Wizzbrew, DM it,
or reply to one of its messages, and forwards each one (with up to 10 messages of reply chain) to
the Vercel app at `<WIZZBREW_URL>/api/message`, signed with HMAC-SHA256. It holds no bot logic:
Vercel posts the reply itself. If Vercel fails, the relay replies once that it can't answer now.

## Environment variables

- `RELAY_SECRET`: shared signing secret, 32 or more characters; must match the Vercel app.
- `DISCORD_BOT_TOKEN`: the bot token.
- `WIZZBREW_URL`: the https base URL of the Vercel deployment.
- `RELAY_CHANNEL_IDS`: comma-separated channel ids where mentions and replies are answered
  (a thread counts when its parent channel is listed). May be empty; DMs always work.

## Discord requirement

Enable the **Message Content** privileged intent for the bot in the Discord developer portal,
or the relay cannot read what people write.

## Railway setup

1. Create a Railway project and a service from this repo, with the root directory set to `relay`.
2. Set the four environment variables above.
3. Set the service settings in Railway itself (it rejects `railway.json` and `railway.toml` as
   deprecated config as code): build command `npm ci && npm run build`, start command
   `npm start`, restart policy always, region US East (`us-east4`).
4. Deploy and check the logs for `relay ready`.
5. Invite the bot with read and send permissions, then @mention it in an allowed channel.
