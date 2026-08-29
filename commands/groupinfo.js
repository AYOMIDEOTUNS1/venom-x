module.exports = {
  run: async ({ sock, from, reply }) => {

    if (!from.endsWith("@g.us")) {
      return reply("❌ Group only");
    }

    const metadata = await sock.groupMetadata(from);

    await reply(
`╭━━〔 👥 VENOM X GROUP INFO 〕━━⬣
┃
┃ 📌 Name: ${metadata.subject}
┃ 👤 Members: ${metadata.participants.length}
┃ 🆔 ID: ${from}
┃
┃ 🤖 Powered by VENOM X
╰━━━━━━━━━━━━━━━━⬣`
    );

  }
};
