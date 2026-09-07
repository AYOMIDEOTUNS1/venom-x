const os = require("os");

function formatRuntime(seconds) {
    seconds = Math.floor(Number(seconds) || 0);
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return (
        String(h).padStart(2, "0") +
        ":" +
        String(m).padStart(2, "0") +
        ":" +
        String(s).padStart(2, "0")
    );
}

module.exports = {
    name: "ping",
    aliases: ["p", "speed"],

    run: async function ({ sock, from, reply, message }) {
        const start = Date.now();

        // Real latency: time until WhatsApp accepts the send
        await sock.sendMessage(from, {
            text: "⏳ Measuring..."
        });

        const speed = Date.now() - start;

        return sock.sendMessage(
            from,
            {
                text:
`╭━━〔 🏓 VENOM X PING 〕━━⬣
┃ ⚡ Speed : ${speed} ms
┃ 🤖 Status : Online
┃ 📡 Platform : Baileys
┃ 💚 Runtime : ${formatRuntime(process.uptime())}
┃ 🖥️ Node : ${process.version}
┃ ⚙️ OS : ${os.platform()}
╰━━━━━━━━━━━━━━━━⬣`
            },
            { quoted: message }
        );
    }
};
