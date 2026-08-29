module.exports = {
    name: "unblock",
    aliases: ["unblockuser"],

    run: async ({ sock, message, args, reply, isOwner }) => {
        if (!isOwner) {
            return reply("❌ Owner only.");
        }

        try {
            const ctx = message.message?.extendedTextMessage?.contextInfo || {};
            let target = null;

            if (message.key?.participantPn) target = message.key.participantPn;
            if (!target && ctx.participantPn) target = ctx.participantPn;

            if (!target && ctx.participant && !String(ctx.participant).endsWith("@lid")) {
                target = ctx.participant;
            }

            if (!target && args[0]) {
                const num = String(args[0]).replace(/\D/g, "");
                if (num.length >= 8) target = num + "@s.whatsapp.net";
            }

            if (!target) {
                return reply(
`╭━━〔 ✅ VENOM X UNBLOCK 〕━━⬣

Reply to a user or type:

#unblock 234xxxxxxxxxx

╰━━━━━━━━━━━━━━━━⬣`
                );
            }

            const num = String(target).replace(/\D/g, "");
            const jid = `${num}@s.whatsapp.net`;

            await sock.updateBlockStatus(jid, "unblock");

            return reply(
`╭━━〔 ✅ VENOM X UNBLOCK 〕━━⬣

✅ Unblocked: ${num}

╰━━━━━━━━━━━━━━━━⬣`
            );

        } catch (err) {
            console.log("UNBLOCK ERROR:", err);
            return reply(`❌ Failed to unblock:\n${err.message}`);
        }
    }
};
