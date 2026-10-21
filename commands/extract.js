"use strict";

const { downloadMediaMessage } = require("@whiskeysockets/baileys");

function getQuoted(message) {
    return (
        message?.message?.extendedTextMessage?.contextInfo?.quotedMessage ||
        null
    );
}

function plainFromMessage(msg) {
    if (!msg) return "";
    return (
        msg.conversation ||
        msg.extendedTextMessage?.text ||
        msg.imageMessage?.caption ||
        msg.videoMessage?.caption ||
        msg.documentMessage?.caption ||
        ""
    ).trim();
}

module.exports = {
    name: "extract",
    aliases: ["extracttext", "gettext", "readfile"],

    run: async function ({ from, message, reply }) {
        const quoted = getQuoted(message);

        if (!quoted) {
            return reply(
`╭━━〔 📝 VENOM EXTRACT 〕━━⬣
┃
┃ Reply to a message or file:
┃ #extract
┃
┃ Supports text, captions, .txt docs
╰━━━━━━━━━━━━━━━━⬣`
            );
        }

        try {
            let text = plainFromMessage(quoted);
            if (text) {
                if (text.length > 3500) {
                    text = text.slice(0, 3500) + "\n\n...TRUNCATED";
                }
                return reply(
                    "╭━━〔 📝 EXTRACT 〕━━⬣\n\n" +
                        text +
                        "\n\n╰━━━━━━━━━━━━━━━━⬣"
                );
            }

            if (quoted.documentMessage) {
                const name = quoted.documentMessage.fileName || "file";
                const mime = quoted.documentMessage.mimetype || "";
                const buf = await downloadMediaMessage(
                    { message: quoted },
                    "buffer",
                    {}
                );
                if (!buf?.length) throw new Error("Empty file");

                const sample = buf.slice(0, 2000).toString("utf8");
                const bad =
                    (sample.match(/[^\x09\x0a\x0d\x20-\x7e]/g) || []).length /
                    Math.max(sample.length, 1);

                if (
                    /text\//i.test(mime) ||
                    /\.(txt|csv|json|md|log|js|ts|html|css)$/i.test(name) ||
                    bad < 0.15
                ) {
                    let out = buf.toString("utf8");
                    if (out.length > 3500) {
                        out = out.slice(0, 3500) + "\n\n...TRUNCATED";
                    }
                    return reply(
                        "╭━━〔 📝 EXTRACT · " +
                            name +
                            " 〕━━⬣\n\n" +
                            out +
                            "\n\n╰━━━━━━━━━━━━━━━━⬣"
                    );
                }

                return reply(
                    "❌ Binary file (`" +
                        name +
                        "`). Use a text/.txt file."
                );
            }

            return reply("❌ No extractable text found.");
        } catch (err) {
            return reply("❌ Extract failed: " + (err.message || err));
        }
    }
};
