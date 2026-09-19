const fs = require("fs");
const path = require("path");
const economy = require("../lib/economy");

function getMentioned(message) {
    var context =
        (message.message &&
            message.message.extendedTextMessage &&
            message.message.extendedTextMessage.contextInfo) ||
        {};
    return (context.mentionedJid && context.mentionedJid[0]) || null;
}

function cleanId(id) {
    return String(id || "").split("@")[0].split(":")[0];
}

function resolveTarget(message, args) {
    var mentioned = getMentioned(message);
    if (mentioned) return mentioned;

    for (var i = 0; i < (args || []).length; i++) {
        var num = String(args[i] || "").replace(/\D/g, "");
        if (num.length > 6) return num + "@s.whatsapp.net";
    }
    return null;
}

function freshAccount() {
    return {
        balance: 0,
        bank: 0,
        bankCapacity: 1000000,
        bankUpgraded: false,
        xp: 0,
        level: 1,
        inventory: {},
        items: {},
        stats: {
            gamesPlayed: 0,
            gamesWon: 0,
            gamesLost: 0,
            duels: 0,
            duelWins: 0,
            duelLosses: 0,
            robAttempts: 0,
            robSuccess: 0,
            robFailed: 0,
            jailed: 0,
            bailed: 0,
            moneyEarned: 0,
            moneyLost: 0
        },
        daily: 0,
        weekly: 0,
        monthly: 0,
        work: 0,
        rob: 0,
        robStars: 0,
        wantedUntil: 0,
        jailedUntil: 0
    };
}

function resetAllEconomy() {
    // Try common economy DB locations
    var candidates = [
        path.join(__dirname, "..", "database", "economy.json"),
        path.join(__dirname, "..", "data", "economy.json"),
        path.join(__dirname, "..", "database", "eco.json"),
        path.join(__dirname, "..", "lib", "economy.json")
    ];

    var file = null;
    for (var i = 0; i < candidates.length; i++) {
        if (fs.existsSync(candidates[i])) {
            file = candidates[i];
            break;
        }
    }

    // Prefer economy helper if available
    if (typeof economy.load === "function" && typeof economy.save === "function") {
        var all = economy.load() || {};
        var count = Object.keys(all).length;
        var wiped = {};
        // empty database
        if (typeof economy.save === "function") {
            economy.save({});
        }
        return { count: count, method: "economy.save" };
    }

    if (!file) {
        // Last attempt: if economy has getAll / _data
        if (economy._data && typeof economy._data === "object") {
            var keys = Object.keys(economy._data);
            for (var k = 0; k < keys.length; k++) {
                delete economy._data[keys[k]];
            }
            return { count: keys.length, method: "memory" };
        }
        throw new Error("Could not find economy database file");
    }

    var raw = fs.readFileSync(file, "utf8") || "{}";
    var data = {};
    try { data = JSON.parse(raw); } catch (e) { data = {}; }

    var total = Object.keys(data).length;
    fs.writeFileSync(file, JSON.stringify({}, null, 2));
    return { count: total, method: file };
}

module.exports = {
    name: "resetgame",
    aliases: ["rgame", "resetaccount", "reseconomy", "resetall"],

    run: async function ({ sock, from, message, sender, args, isOwner, reply }) {
        if (!isOwner) return reply("👑 Owner only.");

        var sub = String((args && args[0]) || "").toLowerCase();
        var target = resolveTarget(message, args);

        // HELP
        if (!sub) {
            return reply(
"╭━━〔 ♻️ RESET GAME 〕━━⬣\n" +
"┃\n" +
"┃ Reset one player:\n" +
"┃ #resetgame @user confirm\n" +
"┃\n" +
"┃ Reset EVERYONE:\n" +
"┃ #resetgame all\n" +
"┃ #resetgame all confirm\n" +
"┃\n" +
"┃ Clear duels only:\n" +
"┃ #resetgame duel\n" +
"╰━━━━━━━━━━━━━━━━⬣"
            );
        }

        // CLEAR DUELS
        if (sub === "duel" || sub === "chat") {
            var cleared = 0;
            try {
                var duel = require("./duel");
                if (duel.pendingDuels) {
                    for (var entry of duel.pendingDuels.entries()) {
                        var key = entry[0];
                        var data = entry[1];
                        if (data && (data.chat === from || String(key).indexOf(from) === 0)) {
                            duel.pendingDuels.delete(key);
                            cleared++;
                        }
                    }
                }
            } catch (e) {}

            try {
                var duelGame = require("./duelgame");
                if (duelGame.games) {
                    for (var g of duelGame.games.entries()) {
                        if (g[1] && g[1].chat === from) {
                            duelGame.games.delete(g[0]);
                            cleared++;
                        }
                    }
                }
            } catch (e) {}

            return reply("✅ Cleared " + cleared + " duel(s) in this chat.");
        }

        // =========================
        // RESET ALL ECONOMY
        // =========================
        if (sub === "all" || sub === "everyone" || sub === "global") {
            var confirmAll = args.some(function (a) {
                return String(a).toLowerCase() === "confirm";
            });

            if (!confirmAll) {
                return sock.sendMessage(from, {
                    text:
"⚠️ *GLOBAL ECONOMY RESET*\n\n" +
"This will wipe *EVERYONE's* game data:\n" +
"• All wallets & banks\n" +
"• All XP & levels\n" +
"• All inventory / items\n" +
"• All stats, jail, wanted\n\n" +
"This cannot be undone.\n\n" +
"Type exactly:\n" +
"#resetgame all confirm"
                }, { quoted: message });
            }

            try {
                var result = resetAllEconomy();
                return sock.sendMessage(from, {
                    text:
"╭━━〔 ♻️ GLOBAL RESET DONE 〕━━⬣\n" +
"┃\n" +
"┃ ✅ Entire economy wiped\n" +
"┃ 👥 Accounts cleared: " + result.count + "\n" +
"┃ 🗂️ Method: " + result.method + "\n" +
"┃\n" +
"┃ Everyone starts from zero.\n" +
"╰━━━━━━━━━━━━━━━━⬣"
                }, { quoted: message });
            } catch (err) {
                return reply("❌ Reset failed: " + err.message + "\n\nSend me: cat lib/economy.js");
            }
        }

        // =========================
        // RESET ONE PLAYER
        // =========================
        if (!target) {
            return reply("Tag a user.\nExample: #resetgame @user confirm");
        }

        var confirm = args.some(function (a) {
            return String(a).toLowerCase() === "confirm";
        });

        if (!confirm) {
            return sock.sendMessage(from, {
                text:
"⚠️ Confirm reset for @" + cleanId(target) + "\n\n" +
"Type:\n#resetgame @" + cleanId(target) + " confirm",
                mentions: [target]
            }, { quoted: message });
        }

        economy.set(target, freshAccount());

        return sock.sendMessage(from, {
            text:
"╭━━〔 ♻️ PLAYER RESET 〕━━⬣\n" +
"┃\n" +
"┃ 👤 @" + cleanId(target) + "\n" +
"┃ ✅ Game fully reset\n" +
"╰━━━━━━━━━━━━━━━━⬣",
            mentions: [target]
        }, { quoted: message });
    }
};
