module.exports = {
    name: "tagall",
    aliases: ["tag", "everyone", "all"],

    run: async ({ sock, from, args, reply, isGroup }) => {
        if (!isGroup) {
            return reply("❌ This command can only be used in groups.");
        }

        try {
            const metadata = await sock.groupMetadata(from);
            const participants = metadata.participants || [];
            const groupName = metadata.subject || "Group";
            const memberCount = participants.length;

            const messageText = args.join(" ").trim() || "Hello everyone!";

            const mentions = participants.map((p) => p.id);

            const tagList = participants
                .map((p, i) => {
                    const num = String(p.id).split("@")[0];
                    return "┃ " + (i + 1) + ". @" + num;
                })
                .join("\n");

            const text =
                "╭━━〔 📢 VENOM X TAGALL 〕━━⬣\n" +
                "┃\n" +
                "┃ 👥 Group: " + groupName + "\n" +
                "┃ 👤 Members: " + memberCount + "\n" +
                "┃\n" +
                "┃ 💬 Message:\n" +
                "┃ " + messageText + "\n" +
                "┃\n" +
                tagList + "\n" +
                "┃\n" +
                "╰━━━━━━━━━━━━━━━━⬣";

            await sock.sendMessage(from, {
                text,
                mentions
            });

        } catch (err) {
            console.log("TAGALL ERROR:", err);
            return reply("❌ Tagall failed:\n" + err.message);
        }
    }
};
