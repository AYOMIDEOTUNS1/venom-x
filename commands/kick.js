module.exports = {
  run: async ({ sock, from, reply, message, quoted }) => {

    if (!from.endsWith("@g.us")) {
      return reply("❌ Group only");
    }

    const mentioned =
      message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];

    const target = mentioned || quoted;

    if (!target) {
      return reply("❌ Tag or reply to the person you want to remove");
    }

    await sock.groupParticipantsUpdate(
      from,
      [target],
      "remove"
    );

    await reply(
`╭━━〔 👢 VENOM X KICK 〕━━⬣
┃
┃ ✅ Member removed
┃ 🚫 Action completed
╰━━━━━━━━━━━━━━━━⬣`
    );

  }
};
