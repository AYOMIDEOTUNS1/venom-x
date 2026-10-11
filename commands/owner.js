module.exports = {
    name: "owner",
    aliases: ["own", "creator", "developers"],

    run: async function ({ sock, from, message, reply }) {
        const owners = [
            { name: "Mide", number: "2349163743900" },
            { name: "VENOM X", number: "2347077417996" },
            { name: "VENOM X 2", number: "2347071970034" }
        ];

        // Send each contact separately (Nexus / Coralz style)
        for (let i = 0; i < owners.length; i++) {
            const o = owners[i];
            const vcard =
                "BEGIN:VCARD\n" +
                "VERSION:3.0\n" +
                "FN:" + o.name + "\n" +
                "ORG:VENOM X;\n" +
                "TEL;type=CELL;type=VOICE;waid=" +
                o.number +
                ":+" +
                o.number +
                "\n" +
                "END:VCARD";

            await sock.sendMessage(
                from,
                {
                    contacts: {
                        displayName: o.name,
                        contacts: [
                            {
                                displayName: o.name,
                                vcard: vcard
                            }
                        ]
                    }
                },
                { quoted: i === 0 ? message : undefined }
            );

            // small gap so cards don't stack weird on some clients
            await new Promise(function (r) {
                setTimeout(r, 400);
            });
        }

        // Caption like Coralz / Azula block
        const numberLines = owners
            .map(function (o) {
                return "┃ +" + o.number;
            })
            .join("\n");

        await reply(
`╭━━〔 👑 VENOM X OWNER 〕━━⬣
┃
┃ 📇 Contacts shared above
┃ Tap *Message* or *Add contact*
┃
┃ Developer Number(s):
${numberLines}
┃
┃ These numbers have full access
┃ on this VENOM X bot.
┃
┃ 🤖 Powered by VENOM X
╰━━━━━━━━━━━━━━━━⬣`
        );
    }
};
