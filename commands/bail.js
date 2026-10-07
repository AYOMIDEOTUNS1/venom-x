const economy = require("../lib/economy");
const { getSettings } = require("../lib/settingsCache");

const BAIL_COST = 50000;

function getOwnerJid() {
    try {
        const s = getSettings() || {};
        let n = s.ownerNumber || s.owner || process.env.OWNER_NUMBER || "";
        if (Array.isArray(n)) n = n[0];
        n = String(n).replace(/\D/g, "");
        if (!n) return null;
        return n + "@s.whatsapp.net";
    } catch (e) {
        return null;
    }
}

module.exports = {
    name: "bail",
    aliases: ["bailout"],

    run: async function ({ sock, from, sender, message, reply }) {
        const user = economy.get(sender);
        const now = Date.now();

        if (!user.jailedUntil || user.jailedUntil <= now) {
            return reply(
"╭━━〔 🚔 BAIL 〕━━⬣\n" +
"┃ You are not in jail.\n" +
"╰━━━━━━━━━━━━━━━━⬣"
            );
        }

        const ownerJid = getOwnerJid();
        if (!ownerJid) {
            return reply("❌ Owner not configured.");
        }

        if (user.balance < BAIL_COST) {
            return reply(
"╭━━〔 🚔 BAIL FAILED 〕━━⬣\n" +
"┃ Bail : " + BAIL_COST.toLocaleString() + " VENOM\n" +
"┃ Wallet : " + Number(user.balance || 0).toLocaleString() + " VENOM\n" +
"┃ ❌ Not enough balance.\n" +
"╰━━━━━━━━━━━━━━━━⬣"
            );
        }

        economy.add(sender, -BAIL_COST);
        economy.add(ownerJid, BAIL_COST);
        economy.set(sender, {
            jailedUntil: 0,
            robStars: 0,
            wantedUntil: 0
        });

        const updated = economy.get(sender);

        return sock.sendMessage(
            from,
            {
                text:
"╭━━〔 🔓 BAIL SUCCESS 〕━━⬣\n" +
"┃ 👤 @" + String(sender).split("@")[0] + "\n" +
"┃ 💸 Paid : " + BAIL_COST.toLocaleString() + " VENOM\n" +
"┃ 💰 Wallet : " + Number(updated.balance || 0).toLocaleString() + "\n" +
"┃ You are free.\n" +
"╰━━━━━━━━━━━━━━━━⬣",
                mentions: [sender]
            },
            { quoted: message }
        );
    }
};
