const economy = require("../lib/economy");

const COOLDOWN = 30 * 60 * 1000;

// Wanted stars disappear after 1h 30m
const WANTED_DURATION = 90 * 60 * 1000;

const MIN_ROB = 5000;
const MAX_ROB = 50000;

const STAR_FINE = {
    1: 10000,
    2: 25000,
    3: 50000
};

const MAX_STARS = 3;
const JAIL_TIME = 60 * 60 * 1000;

function getMentioned(message) {
    const context =
        message?.message?.extendedTextMessage?.contextInfo ||
        message?.message?.imageMessage?.contextInfo ||
        message?.message?.videoMessage?.contextInfo ||
        {};

    return context.mentionedJid?.[0] || null;
}

module.exports = {
    name: "rob",

    run: async ({ sock, from, message, sender, args }) => {
        let targetJid = getMentioned(message);

        if (!targetJid && args[0]) {
            const number = args[0].replace(/\D/g, "");

            if (number) {
                targetJid = `${number}@s.whatsapp.net`;
            }
        }

        if (!targetJid) {
            return sock.sendMessage(
                from,
                {
                    text:
`╭━━〔 🦹 VENOM ROB 〕━━⬣
┃
┃ Usage:
┃ .rob @user
┃
┃ 💰 Steal : 5,000 - 50,000 VENOM
┃
┃ 🚨 Wanted System
┃ ⭐  1st : 10,000 fine
┃ ⭐⭐ 2nd : 25,000 fine
┃ ⭐⭐⭐ 3rd : 50,000 fine + JAIL
┃
┃ ⏳ Wanted status lasts 1h 30m
╰━━━━━━━━━━━━━━━━⬣`
                },
                { quoted: message }
            );
        }

        if (targetJid === sender) {
            return sock.sendMessage(
                from,
                {
                    text: "😂 You can't rob yourself."
                },
                { quoted: message }
            );
        }

        const robber = economy.get(sender);
        const victim = economy.get(targetJid);

        const now = Date.now();

        // =========================
        // CLEAR EXPIRED WANTED
        // =========================

        if (
            robber.wantedUntil &&
            robber.wantedUntil <= now
        ) {
            economy.set(sender, {
                robStars: 0,
                wantedUntil: 0
            });

            robber.robStars = 0;
        }

        // =========================
        // JAIL CHECK
        // =========================

        if (
            robber.jailedUntil &&
            robber.jailedUntil > now
        ) {
            const minutes = Math.ceil(
                (robber.jailedUntil - now) / 60000
            );

            return sock.sendMessage(
                from,
                {
                    text:
`╭━━〔 🚔 YOU ARE IN JAIL 〕━━⬣
┃
┃ 👤 @${sender.split("@")[0]}
┃
┃ 🔒 You cannot rob anyone.
┃ ⏳ Remaining : ${minutes} minutes
┃
┃ 💰 Use .bail for early release.
╰━━━━━━━━━━━━━━━━⬣`,
                    mentions: [sender]
                },
                { quoted: message }
            );
        }

        // =========================
        // ROB COOLDOWN
        // =========================

        if (
            robber.rob &&
            now - robber.rob < COOLDOWN
        ) {
            const minutes = Math.ceil(
                (COOLDOWN - (now - robber.rob)) / 60000
            );

            return sock.sendMessage(
                from,
                {
                    text:
`╭━━〔 ⏳ ROB COOLDOWN 〕━━⬣
┃
┃ 👤 @${sender.split("@")[0]}
┃
┃ Try again in : ${minutes} minutes
╰━━━━━━━━━━━━━━━━⬣`,
                    mentions: [sender]
                },
                { quoted: message }
            );
        }

        if (victim.balance < MIN_ROB) {
            return sock.sendMessage(
                from,
                {
                    text:
`╭━━〔 💰 ROB FAILED 〕━━⬣
┃
┃ 😂 @${targetJid.split("@")[0]} is too broke!
┃
┃ 💵 Wallet : ${victim.balance.toLocaleString()} VENOM
┃
┃ Minimum required : ${MIN_ROB.toLocaleString()}
╰━━━━━━━━━━━━━━━━⬣`,
                    mentions: [sender, targetJid]
                },
                { quoted: message }
            );
        }

        economy.set(sender, {
            rob: now
        });

        // =========================
        // 55% SUCCESS
        // =========================

        const success = Math.random() < 0.55;

        if (!success) {
            const stars =
                Math.min(
                    Number(robber.robStars || 0) + 1,
                    MAX_STARS
                );

            const fine = STAR_FINE[stars];

            economy.add(sender, -fine);

            // Third star = jail
            if (stars >= 3) {
                economy.set(sender, {
                    robStars: 0,
                    wantedUntil: 0,
                    jailedUntil: now + JAIL_TIME
                });

                const updated = economy.get(sender);

                return sock.sendMessage(
                    from,
                    {
                        text:
`╭━━〔 🚔 ROBBER BUSTED 〕━━⬣
┃
┃ 👤 @${sender.split("@")[0]}
┃
┃ 🚓 You were caught robbing
┃ @${targetJid.split("@")[0]}
┃
┃ ⭐⭐⭐ Wanted Level : 3/3
┃
┃ 💸 Fine : ${fine.toLocaleString()} VENOM
┃
┃ 🔒 JAIL SENTENCE : 60 MINUTES
┃
┃ 💰 Wallet : ${updated.balance.toLocaleString()} VENOM
┃
┃ 💵 Early release:
┃ .bail
╰━━━━━━━━━━━━━━━━⬣`,
                        mentions: [sender, targetJid]
                    },
                    { quoted: message }
                );
            }

            economy.set(sender, {
                robStars: stars,
                wantedUntil: now + WANTED_DURATION
            });

            const updated = economy.get(sender);

            return sock.sendMessage(
                from,
                {
                    text:
`╭━━〔 🚨 ROB FAILED 〕━━⬣
┃
┃ 👤 @${sender.split("@")[0]}
┃
┃ 🚓 You were caught robbing
┃ @${targetJid.split("@")[0]}
┃
┃ 💸 Fine : ${fine.toLocaleString()} VENOM
┃
┃ ${"⭐".repeat(stars)}
┃ Wanted Level : ${stars}/3
┃
┃ ⏳ Wanted expires in : 1h 30m
┃
┃ ⚠️ One more failed robbery
┃ can send you to jail.
╰━━━━━━━━━━━━━━━━⬣`,
                    mentions: [sender, targetJid]
                },
                { quoted: message }
            );
        }

        // =========================
        // SUCCESS
        // =========================

        const amount = Math.min(
            Math.floor(
                Math.random() *
                (MAX_ROB - MIN_ROB + 1)
            ) + MIN_ROB,
            victim.balance
        );

        economy.add(targetJid, -amount);
        economy.add(sender, amount);

        const newStars = Math.max(
            0,
            Number(robber.robStars || 0) - 1
        );

        economy.set(sender, {
            robStars: newStars,
            wantedUntil:
                newStars > 0
                    ? now + WANTED_DURATION
                    : 0
        });

        const updated = economy.get(sender);
        const victimUpdated = economy.get(targetJid);

        return sock.sendMessage(
            from,
            {
                text:
`╭━━〔 🦹 ROB SUCCESS 〕━━⬣
┃
┃ 😈 @${sender.split("@")[0]}
┃ successfully robbed
┃ @${targetJid.split("@")[0]}
┃
┃ 🪙 Stolen : ${amount.toLocaleString()} VENOM
┃
┃ ⭐ Wanted : ${newStars}/3
┃
┃ 💰 Your Wallet : ${updated.balance.toLocaleString()}
┃ 💸 Victim Wallet : ${victimUpdated.balance.toLocaleString()}
╰━━━━━━━━━━━━━━━━⬣`,
                mentions: [sender, targetJid]
            },
            { quoted: message }
        );
    }
};
