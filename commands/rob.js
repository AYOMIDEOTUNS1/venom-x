const economy = require("../lib/economy");
const gameEngine = require("../lib/gameEngine");

const COOLDOWN = 30 * 60 * 1000;
const WANTED_DURATION = 90 * 60 * 1000;
const MIN_ROB = 5000;
const MAX_ROB = 50000;
const STAR_FINE = { 1: 10000, 2: 25000, 3: 50000 };
const MAX_STARS = 3;
const JAIL_TIME = 60 * 60 * 1000;

function getMentioned(message) {
    var context =
        (message.message && message.message.extendedTextMessage && message.message.extendedTextMessage.contextInfo) ||
        {};
    return (context.mentionedJid && context.mentionedJid[0]) || null;
}

module.exports = {
    name: "rob",

    run: async function ({ sock, from, message, sender, args }) {
        var targetJid = getMentioned(message);
        if (!targetJid && args[0]) {
            var number = String(args[0]).replace(/\D/g, "");
            if (number) targetJid = number + "@s.whatsapp.net";
        }

        if (!targetJid) {
            return sock.sendMessage(from, {
                text:
"╭━━〔 🦹 VENOM ROB 〕━━⬣\n" +
"┃ Usage: #rob @user\n" +
"┃ Steal: 5,000 - 50,000\n" +
"┃ Failed robberies raise wanted stars\n" +
"┃ 3 stars = jail\n" +
"╰━━━━━━━━━━━━━━━━⬣"
            }, { quoted: message });
        }

        if (targetJid === sender) {
            return sock.sendMessage(from, { text: "😂 You can't rob yourself." }, { quoted: message });
        }

        var robber = economy.get(sender);
        var victim = economy.get(targetJid);
        var now = Date.now();

        if (robber.wantedUntil && robber.wantedUntil <= now) {
            economy.set(sender, { robStars: 0, wantedUntil: 0 });
            robber.robStars = 0;
        }

        if (robber.jailedUntil && robber.jailedUntil > now) {
            var minutes = Math.ceil((robber.jailedUntil - now) / 60000);
            return sock.sendMessage(from, {
                text: "🔒 You are in jail.\n⏳ " + minutes + " minutes left\nUse #bail",
                mentions: [sender]
            }, { quoted: message });
        }

        if (robber.rob && now - robber.rob < COOLDOWN) {
            var wait = Math.ceil((COOLDOWN - (now - robber.rob)) / 60000);
            return sock.sendMessage(from, {
                text: "⏳ Rob cooldown: " + wait + " minutes",
                mentions: [sender]
            }, { quoted: message });
        }

        // VAULT protects bank (future bank rob). For now wallet rob:
        // SHIELD blocks successful wallet robbery
        if (gameEngine.hasItem(targetJid, "shield")) {
            economy.set(sender, { rob: now });
            return sock.sendMessage(from, {
                text:
"╭━━〔 🛡️ ROB BLOCKED 〕━━⬣\n" +
"┃ @" + targetJid.split("@")[0] + " has an active Rob Shield.\n" +
"┃ Your robbery failed.\n" +
"╰━━━━━━━━━━━━━━━━⬣",
                mentions: [sender, targetJid]
            }, { quoted: message });
        }

        if (Number(victim.balance) < MIN_ROB) {
            return sock.sendMessage(from, {
                text: "😂 Target is too broke.\nMin: " + MIN_ROB.toLocaleString(),
                mentions: [targetJid]
            }, { quoted: message });
        }

        economy.set(sender, { rob: now });
        gameEngine.recordGame(sender, "rob", false); // attempt tracked below properly

        var success = Math.random() < 0.55;

        if (!success) {
            var stars = Math.min(Number(robber.robStars || 0) + 1, MAX_STARS);
            var fine = STAR_FINE[stars];
            economy.add(sender, -fine);

            if (stars >= 3) {
                economy.set(sender, {
                    robStars: 0,
                    wantedUntil: 0,
                    jailedUntil: now + JAIL_TIME
                });
                var updated = economy.get(sender);
                return sock.sendMessage(from, {
                    text:
"╭━━〔 🚔 BUSTED 〕━━⬣\n" +
"┃ @" + sender.split("@")[0] + " got caught!\n" +
"┃ ⭐⭐⭐ Wanted 3/3\n" +
"┃ 💸 Fine: " + fine.toLocaleString() + "\n" +
"┃ 🔒 Jail: 60 minutes\n" +
"┃ 💰 Wallet: " + Number(updated.balance).toLocaleString() + "\n" +
"┃ Use #bail\n" +
"╰━━━━━━━━━━━━━━━━⬣",
                    mentions: [sender, targetJid]
                }, { quoted: message });
            }

            economy.set(sender, {
                robStars: stars,
                wantedUntil: now + WANTED_DURATION
            });

            return sock.sendMessage(from, {
                text:
"╭━━〔 🚨 ROB FAILED 〕━━⬣\n" +
"┃ @" + sender.split("@")[0] + " was caught\n" +
"┃ 💸 Fine: " + fine.toLocaleString() + "\n" +
"┃ Wanted: " + stars + "/3\n" +
"╰━━━━━━━━━━━━━━━━⬣",
                mentions: [sender, targetJid]
            }, { quoted: message });
        }

        // SUCCESS
        var amount = Math.min(
            Math.floor(Math.random() * (MAX_ROB - MIN_ROB + 1)) + MIN_ROB,
            Number(victim.balance)
        );

        economy.add(targetJid, -amount);
        economy.add(sender, amount);

        // Shield is single-use style: clear shield after blocking was already handled.
        // Optional: consume shield only when it blocks (already returned above).

        var newStars = Math.max(0, Number(robber.robStars || 0) - 1);
        economy.set(sender, {
            robStars: newStars,
            wantedUntil: newStars > 0 ? now + WANTED_DURATION : 0
        });

        gameEngine.trackMoneyEarned(sender, amount);
        gameEngine.trackMoneyLost(targetJid, amount);

        var updatedRobber = economy.get(sender);
        var updatedVictim = economy.get(targetJid);

        return sock.sendMessage(from, {
            text:
"╭━━〔 🦹 ROB SUCCESS 〕━━⬣\n" +
"┃ 😈 @" + sender.split("@")[0] + " robbed @" + targetJid.split("@")[0] + "\n" +
"┃ 🪙 Stolen: " + amount.toLocaleString() + "\n" +
"┃ ⭐ Wanted: " + newStars + "/3\n" +
"┃ 💰 Your wallet: " + Number(updatedRobber.balance).toLocaleString() + "\n" +
"┃ 💸 Victim wallet: " + Number(updatedVictim.balance).toLocaleString() + "\n" +
"╰━━━━━━━━━━━━━━━━⬣",
            mentions: [sender, targetJid]
        }, { quoted: message });
    }
};
