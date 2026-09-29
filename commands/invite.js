/**
 * VENOM X - Group invite link
 * #invite | #grouplink | #invitelink | #glink
 * (NOT #link — that belongs to pair)
 */

module.exports = {
    name: "invite",
    aliases: ["grouplink", "invitelink", "glink", "gruplink"],

    run: async function ({ sock, from, reply, isGroup }) {
        if (!isGroup) {
            return reply("❌ This command only works in a group.");
        }

        try {
            // bot must be admin for this to work
            const code = await sock.groupInviteCode(from);
            const link = "https://chat.whatsapp.com/" + code;

            return reply(
"╭━━〔 🔗 VENOM GROUP LINK 〕━━⬣\n" +
"┃\n" +
"┃ " + link + "\n" +
"┃\n" +
"┃ Tap to copy / share\n" +
"┃\n" +
"╰━━━━━━━━━━━━━━━━⬣"
            );
        } catch (e) {
            console.log("INVITE ERROR:", e.message || e);
            return reply(
"╭━━〔 ❌ INVITE FAILED 〕━━⬣\n" +
"┃\n" +
"┃ Can't get group link.\n" +
"┃\n" +
"┃ Make sure:\n" +
"┃ • Command is used in a group\n" +
"┃ • VENOM X is *admin*\n" +
"┃\n" +
"┃ Error: " + String(e.message || e).slice(0, 80) + "\n" +
"┃\n" +
"╰━━━━━━━━━━━━━━━━⬣"
            );
        }
    }
};
