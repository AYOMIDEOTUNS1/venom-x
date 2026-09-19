const economy = require("../lib/economy");

module.exports = {
    name: "resetgame",
    aliases: ["rgame", "resetall", "wipeconomy"],

    run: async function ({ sock, from, message, args, isOwner, reply }) {
        if (!isOwner) return reply("👑 Owner only.");

        var sub = String((args && args[0]) || "").toLowerCase();
        var confirm = (args || []).some(function (a) {
            return String(a).toLowerCase() === "confirm";
        });

        if (sub !== "all" && sub !== "everyone" && sub !== "global" && sub !== "economy") {
            return reply(
"╭━━〔 ♻️ RESET GAME 〕━━⬣\n" +
"┃\n" +
"┃ Wipe ALL economy data:\n" +
"┃ #resetgame all\n" +
"┃ #resetgame all confirm\n" +
"┃\n" +
"┃ This sets every wallet/bank/XP to zero.\n" +
"╰━━━━━━━━━━━━━━━━⬣"
            );
        }

        if (!confirm) {
            return sock.sendMessage(from, {
                text:
"⚠️ *FINAL WARNING*\n\n" +
"This will wipe *ALL* money, bank, XP, levels, items, stats.\n" +
"Everyone starts from default.\n\n" +
"Type exactly:\n" +
"#resetgame all confirm"
            }, { quoted: message });
        }

        if (typeof economy.wipeAllEconomy !== "function") {
            return reply("❌ economy.wipeAllEconomy missing.\nPatch lib/economy.js first.");
        }

        var count = economy.wipeAllEconomy();

        // also clear duels
        try {
            var duel = require("./duel");
            if (duel.pendingDuels) duel.pendingDuels.clear();
        } catch (e) {}
        try {
            var duelGame = require("./duelgame");
            if (duelGame.games) duelGame.games.clear();
        } catch (e) {}

        return sock.sendMessage(from, {
            text:
"╭━━〔 ♻️ GLOBAL ECONOMY WIPED 〕━━⬣\n" +
"┃\n" +
"┃ ✅ All wallets cleared\n" +
"┃ ✅ All banks cleared\n" +
"┃ ✅ All XP / levels cleared\n" +
"┃ ✅ All items / stats cleared\n" +
"┃\n" +
"┃ 👥 Accounts wiped: " + count + "\n" +
"┃ 💰 Total wealth: 0\n" +
"┃\n" +
"┃ Everyone starts fresh.\n" +
"╰━━━━━━━━━━━━━━━━⬣"
        }, { quoted: message });
    }
};
