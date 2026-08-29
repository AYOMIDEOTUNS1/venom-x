const fs = require("fs");
const settings = require("../settings.json");

module.exports = {
    run: async ({ isOwner, reply }) => {

        if (!isOwner) {
            return reply("❌ This command is for the bot owner only.");
        }

        settings.mode = "private";

        fs.writeFileSync(
            "./settings.json",
            JSON.stringify(settings, null, 2)
        );

        return reply(`╭━━〔 🔒 PRIVATE MODE 〕━━⬣
┃
┃ ✅ VENOM X is now PRIVATE
┃ 👑 Only the owner can use commands.
┃
╰━━━━━━━━━━━━━━━━⬣`);
    }
};
