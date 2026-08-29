module.exports = {
    name: "update",

    run: async ({ sock, from, message, isOwner }) => {

        if (!isOwner) {
            return sock.sendMessage(
                from,
                {
                    text: "❌ Only the VENOM X owner can use .update."
                },
                { quoted: message }
            );
        }

        if (typeof sock.reloadCommands !== "function") {
            return sock.sendMessage(
                from,
                {
                    text:
                        "❌ Command reload system is not available."
                },
                { quoted: message }
            );
        }

        try {
            await sock.sendMessage(
                from,
                {
                    text: "🔄 Reloading VENOM X commands..."
                },
                { quoted: message }
            );

            sock.reloadCommands();

            await sock.sendMessage(
                from,
                {
                    text:
`╭━━〔 🔄 VENOM X UPDATE 〕━━⬣
┃
┃ ✅ Commands reloaded
┃ ⚡ VENOM X is updated
┃ 🚀 No restart required
╰━━━━━━━━━━━━━━━━⬣`
                },
                { quoted: message }
            );

        } catch (err) {
            console.log(
                "UPDATE ERROR:",
                err.message
            );

            await sock.sendMessage(
                from,
                {
                    text:
                        `❌ UPDATE ERROR: ${err.message}`
                },
                { quoted: message }
            );
        }
    }
};
