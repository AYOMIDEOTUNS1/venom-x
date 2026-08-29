module.exports = {
  run: async ({ sock, from, reply, args }) => {

    if (!from.endsWith("@g.us")) {
      return reply("❌ Group only");
    }

    const metadata = await sock.groupMetadata(from);

    await sock.sendMessage(from, {
      text: args.join(" ") || "📢 VENOM X",
      mentions: metadata.participants.map(p => p.id)
    });

  }
};
