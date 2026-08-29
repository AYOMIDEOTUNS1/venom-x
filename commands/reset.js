const fs = require("fs");
const path = require("path");

const economyFile = path.join(
    __dirname,
    "../database/economy.json"
);

const DEFAULT_BALANCE = 1000;

module.exports = {
    name: "reset",

    run: async ({ sock, from, message, isOwner, args }) => {

        // =========================
        // OWNER ONLY
        // =========================
        if (!isOwner) {
            return sock.sendMessage(
                from,
                {
                    text: "❌ Only the VENOM X owner can use .reset."
                },
                { quoted: message }
            );
        }

        // =========================
        // GET REAL MENTION
        // =========================
        const context =
            message?.message?.extendedTextMessage?.contextInfo;

        const target =
            context?.mentionedJid?.[0] ||
            (args[0]
                ? `${args[0].replace(/\D/g, "")}@s.whatsapp.net`
                : null);

        if (!target || target === "@s.whatsapp.net") {
            return sock.sendMessage(
                from,
                {
                    text:
`╭━━〔 🔄 VENOM RESET 〕━━⬣
┃
┃ Usage:
┃ .reset @user
┃
┃ ⚠️ This resets the player's
┃ economy account.
╰━━━━━━━━━━━━━━━━⬣`
                },
                { quoted: message }
            );
        }

        // =========================
        // LOAD DATABASE
        // =========================
        let data;

        try {
            if (!fs.existsSync(economyFile)) {
                data = {};
            } else {
                data = JSON.parse(
                    fs.readFileSync(economyFile, "utf8")
                );
            }
        } catch (err) {
            return sock.sendMessage(
                from,
                {
                    text: `❌ Economy database error: ${err.message}`
                },
                { quoted: message }
            );
        }

        if (!data[target]) {
            return sock.sendMessage(
                from,
                {
                    text:
`❌ No economy account found for @${target.split("@")[0]}.`,
                    mentions: [target]
                },
                { quoted: message }
            );
        }

        // =========================
        // RESET ACCOUNT
        // =========================
        data[target] = {
            balance: DEFAULT_BALANCE,
            bank: 0,

            daily: 0,
            weekly: 0,
            monthly: 0,
            work: 0,

            robStars: 0,

            jailedUntil: 0
        };

        try {
            fs.writeFileSync(
                economyFile,
                JSON.stringify(data, null, 2)
            );
        } catch (err) {
            return sock.sendMessage(
                from,
                {
                    text: `❌ Failed to save reset: ${err.message}`
                },
                { quoted: message }
            );
        }

        await sock.sendMessage(
            from,
            {
                text:
`╭━━〔 🔄 VENOM RESET 〕━━⬣
┃
┃ 👤 Player : @${target.split("@")[0]}
┃
┃ 💰 Wallet : ${DEFAULT_BALANCE.toLocaleString()} VENOM
┃ 🏦 Bank : 0 VENOM
┃ ⭐ Rob Stars : 0
┃ 🚔 Jail : None
┃
┃ ✅ Economy account reset.
╰━━━━━━━━━━━━━━━━⬣`,
                mentions: [target]
            },
            { quoted: message }
        );
    }
};
