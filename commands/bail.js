const economy = require("../lib/economy");
const settings = require("../settings.json");

const BAIL_COST = 20000;

function getOwnerJid() {
    const value =
        settings.ownerNumber ||
        settings.ownerLid;

    if (!value) return null;

    return economy.normalizeId(value);
}

module.exports = {
    name: "bail",
    aliases: ["release", "free"],

    run: async ({
        sock,
        from,
        message,
        sender
    }) => {

        const user = economy.get(sender);
        const now = Date.now();

        if (
            !user.jailedUntil ||
            user.jailedUntil <= now
        ) {
            return sock.sendMessage(
                from,
                {
                    text:
`╭━━〔 🚔 VENOM BAIL 〕━━⬣
┃
┃ 😂 You're not in jail.
┃
╰━━━━━━━━━━━━━━━━⬣`
                },
                { quoted: message }
            );
        }

        const ownerJid = getOwnerJid();

        if (!ownerJid) {
            return sock.sendMessage(
                from,
                {
                    text:
                        "❌ Owner account is not configured."
                },
                { quoted: message }
            );
        }

        if (user.balance < BAIL_COST) {
            return sock.sendMessage(
                from,
                {
                    text:
`╭━━〔 🚔 BAIL FAILED 〕━━⬣
┃
┃ 💰 Bail : ${BAIL_COST.toLocaleString()} VENOM
┃ 💵 Wallet : ${user.balance.toLocaleString()} VENOM
┃
┃ ❌ You cannot afford bail.
╰━━━━━━━━━━━━━━━━⬣`
                },
                { quoted: message }
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
`╭━━〔 🔓 BAIL SUCCESS 〕━━⬣
┃
┃ 👤 @${sender.split("@")[0]}
┃
┃ 💸 Bail paid : ${BAIL_COST.toLocaleString()} VENOM
┃ 👑 Paid to : BOT OWNER
┃
┃ 🔓 You have been released!
┃
┃ 💰 Wallet : ${updated.balance.toLocaleString()} VENOM
╰━━━━━━━━━━━━━━━━⬣`,
                mentions: [sender]
            },
            { quoted: message }
        );
    }
};
