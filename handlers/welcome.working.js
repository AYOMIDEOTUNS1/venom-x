module.exports = (sock) => {

    console.log("✅ Welcome handler loaded");

    sock.ev.on("group-participants.update", async (update) => {

        try {

            const user = update.participants[0];

            const group = await sock.groupMetadata(update.id);

            const members = group.participants.length;

            if (update.action === "add") {

                await sock.sendMessage(update.id, {
                    text:
`╭━━〔 👋 VENOM X WELCOME 〕━━⬣
┃ 🎉 Welcome @${user.split("@")[0]}
┃ 🏠 Group : ${group.subject}
┃ 👥 Members : ${members}
┃ 📅 Joined : Today
┃
┃ 🚀 Enjoy your stay!
┃ 📖 Please read the group rules.
┃ 🤝 Be respectful to everyone.
┃
┃ 🤖 Powered by VENOM X
╰━━━━━━━━━━━━━━━━⬣`,
                    mentions: [user]
                });

                console.log("✅ Welcome sent.");

            }

            if (update.action === "remove") {

                await sock.sendMessage(update.id, {
                    text:
`╭━━〔 👋 VENOM X GOODBYE 〕━━⬣
┃ 😢 Goodbye @${user.split("@")[0]}
┃ 🏠 Group : ${group.subject}
┃ 👥 Members : ${members}
┃
┃ 💚 We wish you the best.
┃
┃ 🤖 Powered by VENOM X
╰━━━━━━━━━━━━━━━━⬣`,
                    mentions: [user]
                });

                console.log("👋 Goodbye sent.");

            }

        } catch (err) {

            console.log("WELCOME ERROR:", err);

        }

    });

};
