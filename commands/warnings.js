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
    name: "warnings",
    aliases: ["warns", "warninfo"],

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
            getMentioned(message) || sender;

        const warnings =
            warningEngine.getWarnings(
                from,
                target
            );

        if (warnings.length === 0) {
            return sock.sendMessage(
                from,
                {
                    text:
`╭━━〔 🛡️ VENOM WARNINGS 〕━━⬣
┃
┃ 👤 @${cleanId(target)}
┃
┃ ⚠️ Warnings : 0/3
┃
┃ ✅ No active warnings.
╰━━━━━━━━━━━━━━━━⬣`,
                    mentions: [target]
                },
                { quoted: message }
            );
        }

        const list =
            warnings
                .map(
                    (warning, index) =>
`┃ ${index + 1}. ${warning.reason}`
                )
                .join("\n");

        return sock.sendMessage(
            from,
            {
                text:
`╭━━〔 🛡️ VENOM WARNINGS 〕━━⬣
┃
┃ 👤 @${cleanId(target)}
┃
┃ ⚠️ Warnings : ${warnings.length}/3
┃
${list}
┃
┃ 🚨 ${3 - warnings.length} warning(s) remaining.
╰━━━━━━━━━━━━━━━━⬣`,
                mentions: [target]
            },
            { quoted: message }
        );
    }
};
