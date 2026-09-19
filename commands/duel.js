const economy = require("../lib/economy");

const MIN_WAGER = 1000;
const MAX_WAGER = 1000000;
const PENDING_MS = 60 * 1000;

// key = from + challenger + opponent
const pendingDuels = new Map();

function getMentionedJid(message) {
    var context =
        (message.message && message.message.extendedTextMessage && message.message.extendedTextMessage.contextInfo) ||
        {};
    return (context.mentionedJid && context.mentionedJid[0]) || null;
}

function cleanId(id) {
    return String(id || "").split("@")[0].split(":")[0];
}

module.exports = {
    name: "duel",
    aliases: ["challenge"],
    pendingDuels: pendingDuels,

    run: async function ({ sock, from, message, sender, args }) {
        var targetJid = getMentionedJid(message);
        if (!targetJid && args[0]) {
            var number = String(args[0]).replace(/\D/g, "");
            if (number) targetJid = number + "@s.whatsapp.net";
        }

        if (!targetJid) {
            return sock.sendMessage(from, {
                text:
"╭━━〔 ⚔️ VENOM DUEL 〕━━⬣\n" +
"┃ Usage:\n" +
"┃ #duel @user <amount>\n" +
"┃\n" +
"┃ Then opponent:\n" +
"┃ #accept\n" +
"┃\n" +
"┃ Min: " + MIN_WAGER.toLocaleString() + "\n" +
"┃ Max: " + MAX_WAGER.toLocaleString() + "\n" +
"╰━━━━━━━━━━━━━━━━⬣"
            }, { quoted: message });
        }

        if (targetJid === sender) {
            return sock.sendMessage(from, { text: "😂 You can't duel yourself." }, { quoted: message });
        }

        var wager = Number(args[1]);
        if (!Number.isInteger(wager)) wager = Number(args[args.length - 1]);

        if (!Number.isInteger(wager) || wager < MIN_WAGER || wager > MAX_WAGER) {
            return sock.sendMessage(from, {
                text: "❌ Invalid wager.\nMin " + MIN_WAGER.toLocaleString() + " | Max " + MAX_WAGER.toLocaleString()
            }, { quoted: message });
        }

        var player = economy.get(sender);
        var opponent = economy.get(targetJid);
        var now = Date.now();

        if (Number(player.jailedUntil) > now) {
            return sock.sendMessage(from, { text: "🔒 You are in jail." }, { quoted: message });
        }
        if (Number(opponent.jailedUntil) > now) {
            return sock.sendMessage(from, {
                text: "🔒 @" + cleanId(targetJid) + " is in jail.",
                mentions: [targetJid]
            }, { quoted: message });
        }

        if (Number(player.balance) < wager) {
            return sock.sendMessage(from, { text: "❌ Your balance is too low." }, { quoted: message });
        }
        if (Number(opponent.balance) < wager) {
            return sock.sendMessage(from, {
                text: "❌ @" + cleanId(targetJid) + " can't afford this duel.",
                mentions: [targetJid]
            }, { quoted: message });
        }

        var key = from + ":" + sender + ":" + targetJid;
        pendingDuels.set(key, {
            chat: from,
            challenger: sender,
            opponent: targetJid,
            amount: wager,
            expires: now + PENDING_MS
        });

        setTimeout(function () {
            var d = pendingDuels.get(key);
            if (d && d.expires <= Date.now()) pendingDuels.delete(key);
        }, PENDING_MS + 500);

        return sock.sendMessage(from, {
            text:
"╭━━〔 ⚔️ DUEL CHALLENGE 〕━━⬣\n" +
"┃ @" + cleanId(sender) + " challenged @" + cleanId(targetJid) + "\n" +
"┃ 💰 Wager: " + wager.toLocaleString() + " VENOM each\n" +
"┃ ⏱️ Expires: 60s\n" +
"┃\n" +
"┃ @" + cleanId(targetJid) + " type:\n" +
"┃ #accept\n" +
"╰━━━━━━━━━━━━━━━━⬣",
            mentions: [sender, targetJid]
        }, { quoted: message });
    }
};
