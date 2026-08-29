module.exports = {
    name: "delete",
    aliases: ["del", "d"],

    run: async ({ sock, from, message, reply, isGroup, isOwner }) => {
        try {
            const ctx =
                message.message?.extendedTextMessage?.contextInfo ||
                message.message?.imageMessage?.contextInfo ||
                message.message?.videoMessage?.contextInfo ||
                message.message?.stickerMessage?.contextInfo ||
                message.message?.documentMessage?.contextInfo ||
                null;

            if (!ctx || !ctx.stanzaId) {
                return reply(
`╭━━〔 🗑️ VENOM X DELETE 〕━━⬣

Reply to the message you want to delete.

Usage:
#delete
#del
#d

╰━━━━━━━━━━━━━━━━⬣`
                );
            }

            const participant = ctx.participant || undefined;

            const baseKey = {
                remoteJid: from,
                id: ctx.stanzaId
            };

            // 1) Try as bot/own message first
            try {
                await sock.sendMessage(from, {
                    delete: {
                        ...baseKey,
                        fromMe: true
                    }
                });
                return;
            } catch (e1) {
                // continue
            }

            // 2) Try as other user message
            try {
                await sock.sendMessage(from, {
                    delete: {
                        ...baseKey,
                        fromMe: false,
                        participant
                    }
                });
                return;
            } catch (e2) {
                // continue
            }

            // 3) Group admin check only if both failed
            if (isGroup) {
                const botJid = sock.user?.id || "";
                const botNum = String(botJid).split(":")[0].split("@")[0].replace(/\D/g, "");

                let botIsAdmin = false;
                try {
                    const metadata = await sock.groupMetadata(from);
                    const botParticipant = (metadata.participants || []).find((p) => {
                        const pidNum = String(p.id || "").split("@")[0].replace(/\D/g, "");
                        return pidNum === botNum || String(p.id).includes(botNum);
                    });
                    botIsAdmin =
                        botParticipant?.admin === "admin" ||
                        botParticipant?.admin === "superadmin";
                } catch {}

                if (!botIsAdmin) {
                    return reply(
`╭━━〔 🗑️ VENOM X DELETE 〕━━⬣

❌ I need to be a group admin to delete other people's messages.

I can still delete my own messages.

╰━━━━━━━━━━━━━━━━⬣`
                    );
                }

                // Final admin attempt
                await sock.sendMessage(from, {
                    delete: {
                        ...baseKey,
                        fromMe: false,
                        participant
                    }
                });
                return;
            }

            return reply(
`╭━━〔 🗑️ VENOM X DELETE 〕━━⬣

❌ Could not delete that message.

╰━━━━━━━━━━━━━━━━⬣`
            );

        } catch (err) {
            console.log("DELETE ERROR:", err);
            return reply(`❌ Delete failed:\n${err.message}`);
        }
    }
};
