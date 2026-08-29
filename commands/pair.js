const sessionManager = require("../telegram/sessionManager");

module.exports = {
    name: "pair",
    aliases: ["link", "paircode"],

    run: async ({ sock, from, args, reply, isOwner }) => {
        if (!isOwner) {
            return reply("❌ Owner only.");
        }

        const phone = String(args[0] || "").replace(/\D/g, "");

        if (!phone || phone.length < 8 || phone.length > 15) {
            return reply(
`╭━━〔 🔗 VENOM X PAIR 〕━━⬣

Usage:
#pair 234xxxxxxxxxx

Example:
#pair 2348160000000

This will generate a WhatsApp pairing code.

╰━━━━━━━━━━━━━━━━⬣`
            );
        }

        // Telegram owner id (from env) used as session owner key
        const ownerTg =
            String(process.env.OWNER_TELEGRAM_ID || "").replace(/\D/g, "") ||
            "whatsapp";

        await reply(`🚀 Generating pairing code for +${phone}...`);

        try {
            await sessionManager.createSocket(
                ownerTg,
                phone,
                async (text) => {
                    // Send pairing updates back into this WhatsApp chat
                    try {
                        await sock.sendMessage(from, { text: String(text) });
                    } catch {}
                }
            );
        } catch (err) {
            return reply(
`╭━━〔 ❌ VENOM X PAIR 〕━━⬣

Failed to pair +${phone}

${err?.message || err}

╰━━━━━━━━━━━━━━━━⬣`
            );
        }
    }
};
