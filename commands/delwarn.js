const warningEngine = require("../lib/warningEngine");

function getMentioned(message) {
    const context =
        message?.message?.extendedTextMessage?.contextInfo ||
        message?.message?.imageMessage?.contextInfo ||
        message?.message?.videoMessage?.contextInfo ||
        {};

    return context.mentionedJid?.[0] || null;
}

function cleanId(id) {
    return String(id || "")
        .split("@")[0]
        .split(":")[0];
}

module.exports = {
    name: "delwarn",
    aliases: ["unwarn"],

    run: async ({
        sock,
        from,
        message,
        sender
    }) => {

        if (!from?.endsWith("@g.us")) {
            return sock.sendMessage(
                from,
                {
                    text: "❌ Group only."
                },
                { quoted: message }
            );
        }

        const metadata =
            await sock.groupMetadata(from);

        const senderData =
            metadata.participants.find(
                p => p.id === sender
            );

        if (!senderData?.admin) {
            return sock.sendMessage(
                from,
                {
                    text: "❌ Admins only."
                },
                { quoted: message }
            );
        }

        const target =
            getMentioned(message);

        if (!target) {
            return sock.sendMessage(
                from,
                {
                    text:
`Usage:
.delwarn @user`
                },
                { quoted: message }
            );
        }

        const remaining =
            warningEngine.removeWarning(
                from,
                target
            );

        return sock.sendMessage(
            from,
            {
                text:
`╭━━〔 🛡️ VENOM WARNINGS 〕━━⬣
┃
┃ 👤 @${cleanId(target)}
┃
┃ ➖ One warning removed.
┃
┃ ⚠️ Current warnings : ${remaining}/3
╰━━━━━━━━━━━━━━━━⬣`,
                mentions: [target]
            },
            { quoted: message }
        );
    }
};
