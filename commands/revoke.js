/**
 * VENOM X - Revoke group invite link
 * #revoke | #resetlink | #revokeinvite
 */

module.exports = {
    name: "revoke",
    aliases: ["resetlink", "revokeinvite", "revokelink"],

    run: async function ({ sock, from, reply, isGroup, message }) {
        if (!isGroup) {
            return reply("❌ Group only.");
        }

        try {
            // revoke old code
            await sock.groupRevokeInvite(from);

            // fetch new code
            const code = await sock.groupInviteCode(from);
            const link = "https://chat.whatsapp.com/" + code;

            let name = "Group";
            try {
                const metadata = await sock.groupMetadata(from);
                name = metadata.subject || name;
            } catch (e) {}

            let pp = null;
            try {
                pp = await sock.profilePictureUrl(from, "image");
            } catch (e) {}

            const caption =
"╭━━〔 ♻️ VENOM REVOKE 〕━━⬣\n" +
"┃\n" +
"┃ ✅ Old invite link revoked\n" +
"┃ 👥 " + name + "\n" +
"┃\n" +
"┃ 🔗 New link:\n" +
"┃ " + link + "\n" +
"┃\n" +
"╰━━━━━━━━━━━━━━━━⬣";

            if (pp) {
                await sock.sendMessage(
                    from,
                    { image: { url: pp }, caption: caption },
                    { quoted: message }
                );
            } else {
                await reply(caption);
            }
        } catch (e) {
            console.log("REVOKE ERROR:", e.message || e);
            return reply(
"╭━━〔 ❌ REVOKE FAILED 〕━━⬣\n" +
"┃\n" +
"┃ Make sure VENOM X is *admin*.\n" +
"┃\n" +
"┃ " + String(e.message || e).slice(0, 100) + "\n" +
"┃\n" +
"╰━━━━━━━━━━━━━━━━⬣"
            );
        }
    }
};
