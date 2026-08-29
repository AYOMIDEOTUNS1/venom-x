const imageHistory = require("../lib/imageHistory");

module.exports = {
    run: async ({ from, reply }) => {

        const history = imageHistory.get(from);

        if (!history.length) {
            return reply(
`╭━━〔 🎨 VENOM AI HISTORY 〕━━⬣

No images generated yet.

Try:
.imagine a futuristic city

╰━━━━━━━━━━━━━━━━⬣`
            );
        }


        let text =
`╭━━〔 🎨 VENOM AI HISTORY 〕━━⬣

`;

        history.forEach((item, index) => {

            text +=
`${index + 1}. ${item.prompt}
${item.style ? "🎭 " + item.style : ""}
${item.hd ? "⚡ HD" : ""}

`;

        });


        text +=
`╰━━━━━━━━━━━━━━━━⬣`;

        await reply(text);

    }
};
