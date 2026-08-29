module.exports = {
    name: "block",
    aliases: ["blockuser"],

    run: async ({ sock, from, message, args, reply, isOwner }) => {
        if (!isOwner) return reply("❌ Owner only.");

        try {
            const ctx = message.message?.extendedTextMessage?.contextInfo || {};
            const key = message.key || {};
            const candidates = [];

            // Collect every possible identity WhatsApp may provide
            const push = (v) => {
                if (!v) return;
                candidates.push(String(v));
            };

            push(key.participantPn);
            push(key.senderPn);
            push(key.remoteJidAlt);
            push(key.participantAlt);
            push(ctx.participantPn);
            push(ctx.participant);
            push(key.participant);

            // In DM, remoteJid is the other user
            if (from && !from.endsWith("@g.us") && !from.endsWith("@newsletter")) {
                push(from);
            }

            if (Array.isArray(ctx.mentionedJid)) {
                for (const j of ctx.mentionedJid) push(j);
            }

            // Explicit number argument is always best
            if (args[0]) {
                const n = String(args[0]).replace(/\D/g, "");
                if (n.length >= 8) push(n + "@s.whatsapp.net");
            }

            // Prefer real phone JIDs only
            let targetNum = null;

            for (const c of candidates) {
                // already phone jid
                if (c.endsWith("@s.whatsapp.net")) {
                    const n = c.split("@")[0].replace(/\D/g, "");
                    if (n.length >= 8) {
                        targetNum = n;
                        break;
                    }
                }

                // plain digits
                const only = c.replace(/\D/g, "");
                if (only.length >= 10 && only.length <= 15 && !c.includes("@lid")) {
                    targetNum = only;
                    break;
                }
            }

            // Try LID mapping if available in this Baileys build
            if (!targetNum) {
                const lid = candidates.find(c => c.endsWith("@lid"));
                if (lid && sock.signalRepository?.lidMapping?.getPNForLID) {
                    try {
                        const pn = await sock.signalRepository.lidMapping.getPNForLID(lid);
                        if (pn) {
                            targetNum = String(pn).split("@")[0].replace(/\D/g, "");
                        }
                    } catch (e) {
                        console.log("LID map failed:", e.message);
                    }
                }
            }

            if (!targetNum) {
                return reply(
`╭━━〔 🚫 VENOM X BLOCK 〕━━⬣

WhatsApp did not provide this user's number.

Use:
#block 234xxxxxxxxxx

(LID-only chats cannot be blocked by reply)

╰━━━━━━━━━━━━━━━━⬣`
                );
            }

            const jid = `${targetNum}@s.whatsapp.net`;
            await sock.updateBlockStatus(jid, "block");

            return reply(
`╭━━〔 🚫 VENOM X BLOCK 〕━━⬣

✅ Blocked: ${targetNum}

╰━━━━━━━━━━━━━━━━⬣`
            );

        } catch (err) {
            console.log("BLOCK ERROR:", err);
            return reply(`❌ Failed to block:\n${err.message}`);
        }
    }
};
