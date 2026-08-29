module.exports = {
    name: "ping",
    aliases: ["p"],

    run: async ({ sock, from, message }) => {
        const start = process.hrtime.bigint();

        const sent = await sock.sendMessage(
            from,
            {
                text:
`╭━━〔 ⚡ VENOM X PING 〕━━⬣
┃
┃ 🏓 Pong!
┃ ⚡ Speed : calculating...
┃ 🟢 Status : Online
┃ 🤖 Bot : VENOM X
┃
╰━━━━━━━━━━━━━━━━⬣`
            },
            {
                quoted: message
            }
        );

        const end = process.hrtime.bigint();

        const latency =
            Number(end - start) / 1e6;

        console.log(
            `🏓 PING: ${latency.toFixed(2)}ms`
        );

        await sock.sendMessage(
            from,
            {
                text:
`╭━━〔 ⚡ VENOM X PING 〕━━⬣
┃
┃ 🏓 Pong!
┃ ⚡ Speed : ${latency.toFixed(2)}ms
┃ 🟢 Status : Online
┃ 🤖 Bot : VENOM X
┃
╰━━━━━━━━━━━━━━━━⬣`,
                edit: sent.key
            }
        );
    }
};
