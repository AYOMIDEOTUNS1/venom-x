const { downloadContentFromMessage } = require("@whiskeysockets/baileys");

function unwrap(msg) {
    let cur = msg;
    for (let i = 0; i < 5; i++) {
        const w =
            (cur && cur.ephemeralMessage && cur.ephemeralMessage.message) ||
            (cur && cur.viewOnceMessage && cur.viewOnceMessage.message) ||
            (cur && cur.viewOnceMessageV2 && cur.viewOnceMessageV2.message) ||
            null;
        if (!w) break;
        cur = w;
    }
    return cur;
}

module.exports = {
    name: "grouppfp",
    aliases: ["setgcpp", "setgrouppp", "gcpp"],

    run: async function ({ sock, from, message, reply, isGroup }) {
        if (!isGroup) return reply("❌ Group only.");

        const ctx =
            message.message &&
            message.message.extendedTextMessage &&
            message.message.extendedTextMessage.contextInfo;

        const quoted = ctx && ctx.quotedMessage ? unwrap(ctx.quotedMessage) : null;
        if (!quoted || !quoted.imageMessage) {
            return reply("🖼️ Reply to an image with *#grouppfp*\nBot must be admin.");
        }

        try {
            await reply("⏳ Updating group icon...");
            const stream = await downloadContentFromMessage(quoted.imageMessage, "image");
            const chunks = [];
            for await (const c of stream) chunks.push(c);
            const buffer = Buffer.concat(chunks);

            await sock.updateProfilePicture(from, buffer);
            return reply("✅ Group profile photo updated.");
        } catch (e) {
            return reply("❌ Failed:\n" + e.message + "\n\nMake sure bot is *admin*.");
        }
    }
};
