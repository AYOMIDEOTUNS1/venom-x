module.exports = {
  run: async ({ sock, from, reply, message, quoted }) => {

    if (!from.endsWith("@g.us")) {
      return reply("❌ Group only");
    }

    const mentioned =
      message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];

    const target = mentioned || quoted;

    if (!target) {
      return reply("❌ Tag or reply to the admin you want to demote");
    }

    await sock.groupParticipantsUpdate(
      from,
      [target],
      "demote"
    );

    await reply(
`╭━━〔 ⬇️ VENOM X DEMOTE 〕━━⬣
┃
┃ ✅ Admin removed
┃ 👤 Member restored
╰━━━━━━━━━━━━━━━━⬣`
    );

  }
};
