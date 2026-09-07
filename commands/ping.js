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

function card(speedText) {
    return (
`╭━━〔 🏓 VENOM X PING 〕━━⬣
┃ ⚡ Speed : ${speedText}
┃ 🤖 Status : Online
┃ 📡 Platform : Baileys
┃ 💚 Runtime : ${formatRuntime(process.uptime())}
┃ 🖥️ Node : ${process.version}
┃ ⚙️ OS : ${os.platform()}
╰━━━━━━━━━━━━━━━━⬣`
    );
}

module.exports = {
    name: "ping",
    aliases: ["p", "speed"],

    run: async function ({ sock, from, message }) {
        const start = Date.now();

        // 1) Show calculating
        const sent = await sock.sendMessage(
            from,
            { text: card("Calculating...") },
            { quoted: message }
        );

        // 2) Real latency (send round-trip work)
        await Promise.resolve();
        const speed = Date.now() - start;

        const finalText = card(speed + " ms");

        // 3) Edit same message (fallback: new message)
        try {
            await sock.sendMessage(from, {
                text: finalText,
                edit: sent.key
            });
        } catch (e) {
            await sock.sendMessage(
                from,
                { text: finalText },
                { quoted: message }
            );
        }
    }
};
