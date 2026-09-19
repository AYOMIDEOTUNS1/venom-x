const economy = require("../lib/economy");

const JAIL_TIME = 60 * 60 * 1000; // 60 minutes

function getTargetJid(message, args) {
    // 1) Mention
    var context =
        (message.message &&
            message.message.extendedTextMessage &&
            message.message.extendedTextMessage.contextInfo) ||
        {};

    if (context.mentionedJid && context.mentionedJid[0]) {
        return context.mentionedJid[0];
    }

    // 2) Reply
    if (context.participant) {
        return context.participant;
    }

    // 3) Number in args
    for (var i = 0; i < (args || []).length; i++) {
        var num = String(args[i] || "").replace(/\D/g, "");
        if (num.length > 6) {
            return num + "@s.whatsapp.net";
        }
    }

    return null;
}

function cleanId(id) {
    return String(id || "").split("@")[0].split(":")[0];
}

function normalize(id) {
    if (typeof economy.normalizeId === "function") {
        return economy.normalizeId(id);
    }
    return String(id || "");
}

module.exports = {
    name: "jail",
    aliases: ["prison"],

    run: async function ({
        sock,
        from,
        message,
        sender,
        args,
        isOwner,
        reply
    }) {
        if (!isOwner) {
            return sock.sendMessage(from, {
                text:
"╭━━〔 🚔 VENOM JAIL 〕━━⬣\n" +
"┃\n" +
"┃ ❌ ACCESS DENIED\n" +
"┃ 👑 Owner only\n" +
"╰━━━━━━━━━━━━━━━━⬣"
            }, { quoted: message });
        }

        var sub = String((args && args[0]) || "").toLowerCase();

        // =========================
        // UNJAIL
        // =========================
        if (sub === "release" || sub === "free" || sub === "unjail") {
            var freeTarget = getTargetJid(message, args.slice(1));
            if (!freeTarget) {
                return reply("Usage:\n#jail release @user");
            }

            freeTarget = normalize(freeTarget);
            economy.set(freeTarget, {
                jailedUntil: 0,
                robStars: 0,
                wantedUntil: 0
            });

            return sock.sendMessage(from, {
                text:
"╭━━〔 🔓 RELEASED 〕━━⬣\n" +
"┃\n" +
"┃ 👤 @" + cleanId(freeTarget) + "\n" +
"┃ ✅ Released from jail\n" +
"╰━━━━━━━━━━━━━━━━⬣",
                mentions: [freeTarget]
            }, { quoted: message });
        }

        // =========================
        // JAIL USER
        // =========================
        var targetJid = getTargetJid(message, args);

        if (!targetJid) {
            return sock.sendMessage(from, {
                text:
"╭━━〔 🚔 VENOM JAIL 〕━━⬣\n" +
"┃\n" +
"┃ Usage:\n" +
"┃ #jail @user\n" +
"┃ #jail @user 30   (custom minutes)\n" +
"┃ #jail release @user\n" +
"┃\n" +
"┃ Or reply to their message:\n" +
"┃ #jail\n" +
"┃\n" +
"┃ Default sentence: 60 minutes\n" +
"╰━━━━━━━━━━━━━━━━⬣"
            }, { quoted: message });
        }

        targetJid = normalize(targetJid);
        var senderId = normalize(sender);

        if (targetJid === senderId) {
            return reply("😂 You can't jail yourself.");
        }

        // Optional custom minutes: #jail @user 30
        var minutes = 60;
        for (var i = 0; i < args.length; i++) {
            var n = Number(args[i]);
            if (Number.isInteger(n) && n > 0 && n <= 1440) {
                minutes = n;
                break;
            }
        }

        var jailMs = minutes * 60 * 1000;
        var user = economy.get(targetJid);
        var now = Date.now();

        if (user.jailedUntil && user.jailedUntil > now) {
            var left = Math.ceil((user.jailedUntil - now) / 60000);
            return sock.sendMessage(from, {
                text:
"🚔 @" + cleanId(targetJid) + " is already jailed.\n" +
"⏳ Remaining: " + left + " minutes",
                mentions: [targetJid]
            }, { quoted: message });
        }

        economy.set(targetJid, {
            jailedUntil: now + jailMs,
            robStars: 0,
            wantedUntil: 0
        });

        return sock.sendMessage(from, {
            text:
"╭━━〔 🚔 VENOM JAIL 〕━━⬣\n" +
"┃\n" +
"┃ 👑 OWNER ACTION\n" +
"┃\n" +
"┃ 🔒 Prisoner: @" + cleanId(targetJid) + "\n" +
"┃ ⏱️ Sentence: " + minutes + " minutes\n" +
"┃\n" +
"┃ ⭐ Wanted level cleared\n" +
"┃\n" +
"┃ Early release:\n" +
"┃ #bail  (player)\n" +
"┃ #jail release @user  (owner)\n" +
"╰━━━━━━━━━━━━━━━━⬣",
            mentions: [targetJid]
        }, { quoted: message });
    }
};
