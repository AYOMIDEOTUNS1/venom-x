const glb = require("../lib/glb");

module.exports = {
    name: "glb",
    aliases: ["globalboard", "global"],

    run: async ({
        sock,
        from,
        message,
        isGroup
    }) => {

        const overall =
            glb.overall(10);

        const current =
            glb.currentPhase();

        let text =
`╭━━〔 🌍 VENOM GLOBAL LEADERBOARD 〕━━⬣
┃
┃ 🏆 OVERALL TOP PLAYERS
┃
`;

        if (!overall.length) {
            text +=
`┃ ❌ No players found.
┃
`;
        } else {
            const medals = [
                "🥇",
                "🥈",
                "🥉"
            ];

            overall.forEach((player, index) => {

                const medal =
                    medals[index] ||
                    `${index + 1}.`;

                text +=
`┃ ${medal} @${player.id.split("@")[0]}
┃    💎 Wealth : ${player.wealth.toLocaleString()} VENOM
┃    ⭐ Level  : ${player.level}
┃    ✨ XP     : ${player.xp.toLocaleString()}
┃
`;
            });
        }

        text +=
`┃━━━━━━━━━━━━━━━━━━
┃
┃ 🔥 CURRENT PHASE
┃ ${current.phase.name}
┃
`;

        const phase =
            glb.phaseLeaderboard(10);

        if (!phase.length) {

            text +=
`┃ ❌ No phase scores yet.
┃
`;

        } else {

            const medals = [
                "🥇",
                "🥈",
                "🥉"
            ];

            phase.forEach((player, index) => {

                const medal =
                    medals[index] ||
                    `${index + 1}.`;

                text +=
`┃ ${medal} @${player.id.split("@")[0]}
┃    🏆 Score : ${player.score.toLocaleString()}
┃    🎮 Games : ${player.gamesPlayed}
┃    👑 Wins  : ${player.gamesWon}
┃
`;
            });
        }

        text +=
`╰━━━━━━━━━━━━━━━━⬣`;

        const mentions = [
            ...overall.map(p => p.id),
            ...phase.map(p => p.id)
        ];

        await sock.sendMessage(
            from,
            {
                text,
                mentions: [
                    ...new Set(mentions)
                ]
            },
            {
                quoted: message
            }
        );
    }
};
