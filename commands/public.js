const fs = require("fs");
const settings = require("../settings.json");

module.exports = {
    run: async ({ isOwner, reply }) => {

        if (!isOwner) {
            return reply("❌ This command is for the bot owner only.");
        }

        settings.mode = "public";

        fs.writeFileSync(
            "./settings.json",
            JSON.stringify(settings, null, 2)
        );

        return reply(
`╭━━〔 🌍 PUBLIC MODE 〕━━⬣
┃
┃ ✅ VENOM X is now PUBLIC
┃ 🌎 Everyone can use commands.
┃
╰━━━━━━━━━━━━━━━━⬣`
        );
    }
};
