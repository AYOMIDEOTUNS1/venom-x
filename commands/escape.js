const economy = require("../lib/economy");

const ESCAPE_COST = 10000;
const FAILED_ESCAPE_FINE = 5000;

module.exports = {
    name: "escape",

    run: async ({ sock, from, message, sender }) => {
        const user = economy.get(sender);
        const now = Date.now();

        // ===================== NOT JAILED =====================
        if (!user.jailedUntil || user.jailedUntil <= now) {
            return sock.sendMessage(
                from,
                {
                    text:
`╭━━〔 🔓 ESCAPE 〕━━⬣
┃
┃ 😂 You're not in jail!
┃
┃ You can walk freely.
╰━━━━━━━━━━━━━━━━⬣`
                },
                { quoted: message }
            );
        }

        const remaining = Math.ceil(
            (user.jailedUntil - now) / 60000
        );

        // ===================== ESCAPE ATTEMPT =====================
        const success = Math.random() < 0.60;

        // ===================== FAILED ESCAPE =====================
        if (!success) {

            // Fine can push balance into negative
            economy.add(sender, -FAILED_ESCAPE_FINE);

            const updated = economy.get(sender);

            return sock.sendMessage(
                from,
                {
                    text:
`╭━━〔 🚨 ESCAPE FAILED 〕━━⬣
┃
┃ 👤 @${sender.split("@")[0]}
┃
┃ 🚔 The guards caught you!
┃
┃ 💸 Fine : ${FAILED_ESCAPE_FINE.toLocaleString()} VENOM
┃ 💰 Wallet : ${updated.balance.toLocaleString()} VENOM
┃
┃ ⏳ Remaining : ${remaining} minutes
╰━━━━━━━━━━━━━━━━⬣`,
                    mentions: [sender]
                },
                { quoted: message }
            );
        }

        // ===================== SUCCESS =====================
        // Cost can push balance into negative
        economy.add(sender, -ESCAPE_COST);

        economy.set(sender, {
            jailedUntil: 0
        });

        const updated = economy.get(sender);

        await sock.sendMessage(
            from,
            {
                text:
`╭━━〔 🔓 ESCAPE SUCCESS 〕━━⬣
┃
┃ 😈 @${sender.split("@")[0]}
┃ escaped from jail!
┃
┃ 💸 Escape Cost : ${ESCAPE_COST.toLocaleString()} VENOM
┃ 💰 Wallet : ${updated.balance.toLocaleString()} VENOM
┃
┃ 🏃 You're free!
╰━━━━━━━━━━━━━━━━⬣`,
                mentions: [sender]
            },
            { quoted: message }
        );
    }
};
