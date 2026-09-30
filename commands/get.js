/**
 * VENOM X - #get
 * Fetch a URL → show status / type / preview
 * If response is an image → send the image
 */

const axios = require("axios");

function pickUrl(text) {
    const m = String(text || "").match(/(https?:\/\/[^\s]+)/i);
    return m ? m[0] : null;
}

function modeFromType(type) {
    type = String(type || "").toLowerCase();
    if (type.indexOf("json") !== -1) return "JSON";
    if (type.indexOf("html") !== -1) return "HTML";
    if (type.indexOf("xml") !== -1) return "XML";
    if (type.indexOf("text") !== -1) return "TEXT";
    if (type.indexOf("image") !== -1) return "IMAGE";
    if (type.indexOf("video") !== -1) return "VIDEO";
    if (type.indexOf("audio") !== -1) return "AUDIO";
    return "OTHER";
}

function isImageType(type, url) {
    type = String(type || "").toLowerCase();
    if (type.indexOf("image/") !== -1) return true;
    // fallback by extension
    return /\.(jpg|jpeg|png|gif|webp|bmp)(\?|$)/i.test(String(url || ""));
}

function previewBody(data) {
    let text = "";
    if (Buffer.isBuffer(data)) {
        text = data.toString("utf8");
    } else if (typeof data === "object") {
        try {
            text = JSON.stringify(data, null, 2);
        } catch (e) {
            text = String(data);
        }
    } else {
        text = String(data || "");
    }

    text = text.replace(/\r/g, "");
    if (text.length > 900) {
        text = text.slice(0, 900) + "\n\n...TRUNCATED";
    }
    return text;
}

module.exports = {
    name: "get",
    aliases: ["fetch", "httpget", "curl"],

    run: async function ({ sock, from, args, reply, message }) {
        const input = (args || []).join(" ").trim();
        const url = pickUrl(input);

        if (!url) {
            return reply(
"╭━━〔 🌐 VENOM GET 〕━━⬣\n" +
"┃\n" +
"┃ Usage:\n" +
"┃ #get https://example.com\n" +
"┃\n" +
"┃ Images are sent as photos.\n" +
"┃\n" +
"╰━━━━━━━━━━━━━━━━⬣"
            );
        }

        try {
            await reply("🌐 Fetching...");

            const start = Date.now();
            const res = await axios.get(url, {
                timeout: 25000,
                maxRedirects: 5,
                responseType: "arraybuffer",
                validateStatus: function () {
                    return true;
                },
                headers: {
                    "User-Agent":
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) VENOM-X",
                    Accept: "*/*"
                }
            });
            const ms = Date.now() - start;

            const type =
                (res.headers && res.headers["content-type"]) || "unknown";
            const mode = modeFromType(type);
            const buf = Buffer.from(res.data || []);

            const caption =
"╭━━〔 🌐 VENOM FETCH 〕━━⬣\n" +
"┃\n" +
"┃ 🔗 URL\n" +
"┃ " + url + "\n" +
"┃\n" +
"┃ 📡 Status : " + res.status + "\n" +
"┃ ⚡ Time   : " + ms + "ms\n" +
"┃ 📦 Type   : " + type + "\n" +
"┃ 🧾 Mode   : " + mode + "\n" +
"┃ 📏 Size   : " + buf.length + " bytes\n" +
"┃\n" +
"╰━━━━━━━━━━━━━━━━⬣";

            // IMAGE → send photo
            if (res.status >= 200 && res.status < 400 && isImageType(type, url) && buf.length > 500) {
                return sock.sendMessage(
                    from,
                    {
                        image: buf,
                        caption: caption
                    },
                    { quoted: message }
                );
            }

            // TEXT / HTML / JSON preview
            const body = previewBody(buf);
            return reply(
                caption.replace(
                    "╰━━━━━━━━━━━━━━━━⬣",
                    "┃ 📄 Preview\n┃ " +
                        body.split("\n").join("\n┃ ") +
                        "\n┃\n╰━━━━━━━━━━━━━━━━⬣"
                )
            );
        } catch (e) {
            return reply(
"╭━━〔 ❌ VENOM FETCH 〕━━⬣\n" +
"┃\n" +
"┃ 🔗 " + url + "\n" +
"┃\n" +
"┃ ❌ " + (e.message || e) + "\n" +
"┃\n" +
"╰━━━━━━━━━━━━━━━━⬣"
            );
        }
    }
};
