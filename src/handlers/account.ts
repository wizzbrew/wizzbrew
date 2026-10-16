import { log } from "../log.js";
import { open } from "../store/crypto.js";
import type { Answer, Asker } from "../types.js";
import { deleteLink, getLink } from "../wizzrobe/identity.js";
import { revoke, startLink } from "../wizzrobe/oauth.js";

// Link and unlink. Every answer is private: the link URL starts a login for this Discord user.
export async function accountAnswer(
  action: "link" | "unlink",
  asker: Asker,
  _now: Date,
): Promise<Answer> {
  const id = asker.discordUserId;
  const rec = await getLink(id);

  if (action === "link") {
    if (rec) {
      return {
        text: `You're linked to Wizzrobe as ${rec.username}. Say unlink (or use /unlink) first to switch accounts.`,
        ephemeral: true,
      };
    }
    const { url } = await startLink(id);
    return {
      text: `Link your Wizzrobe account so I can act for you: [Link Wizzrobe](<${url}>). The link works once and expires in 10 minutes.`,
      ephemeral: true,
    };
  }

  if (!rec) return { text: "You're not linked.", ephemeral: true };
  try {
    await revoke(await open(rec.sealedRefreshToken));
  } catch (err) {
    const status = (err as { status?: unknown }).status;
    log("warn", "account.revoke_failed", { status: typeof status === "number" ? status : null });
  }
  await deleteLink(id);
  return { text: "Unlinked. Ask me to link again any time.", ephemeral: true };
}
