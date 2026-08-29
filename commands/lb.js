const economy = require("../lib/economy");

module.exports = {
    name: "lb",
    aliases: ["leaderboard", "rich"],

    run: async ({
        sock,
        from,
        message,
        isGroup
    }) => {

        if (!isGroup) {
            return sock.sendMessage(
                from,
                {
                    text:
`╭━━〔 🏆 VENOM LEADERBOARD 〕━━⬣
┃
┃ ❌ This command is for groups only.
┃
┃ 🌍 Use .glb for the global leaderboard.
╰━━━━━━━━━━━━━━━━⬣`
                },
                { quoted: message }
            );
        }

        let metadata;

        try {
            metadata = await sock.groupMetadata(from);
        } catch (err) {
            console.log(
                "LB GROUP METADATA ERROR:",
                err.message
            );

            return sock.sendMessage(
                from,
                {
                    text: "❌ I couldn't read this group's members."
                },
                { quoted: message }
            );
        }

        const participants =
            metadata?.participants || [];

        const allUsers = economy.all();
        const players = [];

        for (const participant of participants) {

            const jid =
                participant.id ||
                participant.jid;

            const canonical =
                economy.normalizeId(jid);

            if (!canonical) continue;

            // Do NOT create an account here.
            const user = allUsers[canonical];

            if (!user) continue;

            const balance =
                Number(user.balance) || 0;

            const bank =
                Number(user.bank) || 0;

            const level =
                Number(user.level) || 1;

            const xp =
                Number(user.xp) || 0;

            players.push({
                jid: canonical,
                number: canonical.split("@")[0],
                balance,
                bank,
                level,
                xp,
                total: balance + bank
            });
        }

        players.sort(
            (a, b) => b.total - a.total
        );

        const topPlayers =
            players.slice(0, 10);

        if (!topPlayers.length) {
            return sock.sendMessage(
                from,
                {
                    text:
`╭━━〔 🏆 VENOM X GROUP LEADERBOARD 〕━━⬣
┃
┃ 👥 ${metadata.subject || "This Group"}
┃
┃ ❌ No economy players found yet.
┃
┃ 💡 Use an economy command to join.
╰━━━━━━━━━━━━━━━━⬣`
                },
                { quoted: message }
            );
        }

        const medals = [
            "🥇",
            "🥈",
            "🥉"
        ];

        const mentions = [];

        let text =
`╭━━〔 🏆 VENOM X GROUP LEADERBOARD 〕━━⬣
┃
┃ 👥 ${metadata.subject || "This Group"}
┃ 🎮 Economy Players : ${players.length}
┃
`;

        topPlayers.forEach((player, index) => {

            const rank =
                medals[index] ||
                `${index + 1}.`;

            text +=
`┃ ${rank} @${player.number}
┃    💵 Wallet : ${player.balance.toLocaleString()} VENOM
┃    🏦 Bank : ${player.bank.toLocaleString()} VENOM
┃    💎 Wealth : ${player.total.toLocaleString()} VENOM
┃    ⭐ Level : ${player.level}
┃    ✨ XP : ${player.xp.toLocaleString()}
┃
`;

            mentions.push(player.jid);
        });

        text +=
`╰━━━━━━━━━━━━━━━━⬣`;

        return sock.sendMessage(
            from,
            {
                text,
                mentions: [...new Set(mentions)]
            },
            { quoted: message }
        );
    }
};
