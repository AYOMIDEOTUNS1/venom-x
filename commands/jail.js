const economy = require("../lib/economy");

const JAIL_TIME = 60 * 60 * 1000;
const JAIL_COST = 5000;

module.exports = {
    name: "jail",

    run: async ({
        sock,
        from,
        message,
        sender,
        args,
        isOwner
    }) => {

        if (!isOwner) {
            return sock.sendMessage(
                from,
                {
                    text:
`╭━━〔 🚔 VENOM JAIL 〕━━⬣
┃
┃ ❌ ACCESS DENIED
┃
┃ 👑 Only the VENOM X owner
┃ can use .jail.
╰━━━━━━━━━━━━━━━━⬣`
                },
                { quoted: message }
            );
        }

        if (!args[0]) {
            return sock.sendMessage(
                from,
                {
                    text:
`╭━━〔 🚔 VENOM JAIL 〕━━⬣
┃
┃ Usage:
┃ .jail @user
┃
┃ 💰 Cost : ${JAIL_COST.toLocaleString()} VENOM
┃ ⏱️ Sentence : 60 minutes
╰━━━━━━━━━━━━━━━━⬣`
                },
                { quoted: message }
            );
        }

        const target =
            args[0].replace(/\D/g, "");

        if (!target) {
            return sock.sendMessage(
                from,
                {
                    text: "❌ Invalid player."
                },
                { quoted: message }
            );
        }

        const targetJid =
            `${target}@s.whatsapp.net`;

        if (targetJid === sender) {
            return sock.sendMessage(
                from,
                {
                    text: "😂 You can't jail yourself."
                },
                { quoted: message }
            );
        }

        const targetUser =
            economy.get(targetJid);

        const now = Date.now();

        if (
            targetUser.jailedUntil &&
            targetUser.jailedUntil > now
        ) {
            const remaining = Math.ceil(
                (targetUser.jailedUntil - now) / 60000
            );

            return sock.sendMessage(
                from,
                {
                    text:
`🚔 @${target} is already jailed.

⏳ Remaining : ${remaining} minutes`,
                    mentions: [targetJid]
                },
                { quoted: message }
            );
        }

        economy.set(targetJid, {
            jailedUntil: now + JAIL_TIME,
            robStars: 0,
            wantedUntil: 0
        });

        return sock.sendMessage(
            from,
            {
                text:
`╭━━〔 🚔 VENOM JAIL 〕━━⬣
┃
┃ 👑 OWNER ACTION
┃
┃ 🔒 Prisoner : @${target}
┃ ⏱️ Sentence : 60 minutes
┃
┃ ⭐ Wanted level cleared
┃
┃ 💵 Bail available:
┃ .bail
╰━━━━━━━━━━━━━━━━⬣`,
                mentions: [targetJid]
            },
            { quoted: message }
        );
    }
};
