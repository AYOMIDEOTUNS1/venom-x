const economy = require("../lib/economy");
const rewardXP = require("../lib/rewardXP");

const COOLDOWN = 60 * 60 * 1000;

const jobs = [
    "coded a website",
    "fixed a phone",
    "delivered a package",
    "designed a logo",
    "washed a car",
    "worked at a restaurant",
    "edited a video",
    "sold some gadgets",
    "completed a freelance job",
    "helped a customer"
];

module.exports = {
    name: "work",

    run: async ({ sock, from, message, sender }) => {

        const user = economy.get(sender);
        const now = Date.now();

        // =========================
        // COOLDOWN
        // =========================

        if (
            user.work &&
            now - user.work < COOLDOWN
        ) {
            const remaining =
                COOLDOWN - (now - user.work);

            const minutes = Math.ceil(
                remaining / (60 * 1000)
            );

            return sock.sendMessage(
                from,
                {
                    text:
`╭━━〔 💼 VENOM WORK 〕━━⬣
┃
┃ 👤 @${sender.split("@")[0]}
┃
┃ 😮 You've already worked!
┃ ⏳ Try again in : ${minutes} minutes
┃
╰━━━━━━━━━━━━━━━━⬣`,
                    mentions: [sender]
                },
                {
                    quoted: message
                }
            );
        }

        // =========================
        // WORK REWARD
        // =========================

        const reward =
            Math.floor(
                Math.random() * 4501
            ) + 1500;

        const job =
            jobs[
                Math.floor(
                    Math.random() * jobs.length
                )
            ];

        // =========================
        // GIVE MONEY
        // =========================

        economy.add(
            sender,
            reward
        );

        // =========================
        // SET COOLDOWN
        // =========================

        economy.set(
            sender,
            {
                work: now
            }
        );

        // =========================
        // GIVE XP
        // =========================

        const xpResult = await rewardXP({
            sock,
            from,
            message,
            sender,
            amount: 100
        });

        // =========================
        // UPDATED ACCOUNT
        // =========================

        const updated =
            economy.get(sender);

        // =========================
        // WORK RESULT
        // =========================

        await sock.sendMessage(
            from,
            {
                text:
`╭━━〔 💼 VENOM WORK 〕━━⬣
┃
┃ 👤 @${sender.split("@")[0]}
┃
┃ 💼 Job : ${job}
┃
┃ 🪙 Earned : ${reward.toLocaleString()} VENOM
┃ ✨ XP Earned : +100
┃
┃ ⭐ Level : ${xpResult.level}
┃ 🏆 Rank : ${xpResult.rank}
┃
┃ 💰 Balance : ${updated.balance.toLocaleString()} VENOM
┃
┃ 🔄 Come back in 1 hour!
╰━━━━━━━━━━━━━━━━⬣`,
                mentions: [sender]
            },
            {
                quoted: message
            }
        );
    }
};
