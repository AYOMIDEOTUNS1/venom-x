module.exports = {
    name: "whoami",
    aliases: ["myid", "id"],
    run: async function ({ reply, sender, senderPn, participantPn, isOwner, message, settings }) {
        return reply(
"╭━━〔 🆔 WHOAMI 〕━━⬣\n" +
"┃ sender: " + sender + "\n" +
"┃ senderPn: " + senderPn + "\n" +
"┃ participantPn: " + participantPn + "\n" +
"┃ fromMe: " + !!(message && message.key && message.key.fromMe) + "\n" +
"┃ isOwner: " + isOwner + "\n" +
"┃ ownerNumber: " + (settings && settings.ownerNumber) + "\n" +
"┃ ownerLid: " + (settings && settings.ownerLid) + "\n" +
"╰━━━━━━━━━━━━━━━━⬣"
        );
    }
};
