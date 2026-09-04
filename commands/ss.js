const axios = require("axios");

function normalizeUrl(input) {
    let url = String(input || "").trim();
    if (!url) return null;
    if (!/^https?:\/\//i.test(url)) url = "https://" + url;
    try {
        const u = new URL(url);
        if (u.protocol !== "http:" && u.protocol !== "https:") return null;
        return u.toString();
    } catch (e) {
        return null;
    }
}

async function downloadImage(url) {
    const res = await axios.get(url, {
        responseType: "arraybuffer",
        timeout: 60000,
        maxRedirects: 5,
        headers: {
            "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36",
            Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8"
        },
        validateStatus: function (s) {
            return s >= 200 && s < 400;
        }
    });
    const buf = Buffer.from(res.data);
    if (!buf || buf.length < 2000) throw new Error("empty image");
    return buf;
}

async function capture(url) {
    const encoded = encodeURIComponent(url);
    const tries = [
        // microlink (often works)
        "https://api.microlink.io/?url=" + encoded + "&screenshot=true&meta=false&embed=screenshot.url",
        // wordpresstv style proxies / screenshot services
        "https://s0.wp.com/mshots/v1/" + encoded + "?w=1200",
        "https://image.thum.io/get/width/1200/noanimate/" + url,
        "https://image.thum.io/get/width/800/" + url
    ];

    const errors = [];

    // microlink returns JSON with screenshot url
    try {
        const ml = await axios.get(tries[0], {
            timeout: 45000,
            headers: { "User-Agent": "VENOM-X" }
        });
        const shot =
            ml.data &&
            ml.data.data &&
            ml.data.data.screenshot &&
            ml.data.data.screenshot.url;
        if (shot) return await downloadImage(shot);
        errors.push("microlink: no screenshot url");
    } catch (e) {
        errors.push("microlink: " + e.message);
    }

    for (let i = 1; i < tries.length; i++) {
        try {
            return await downloadImage(tries[i]);
        } catch (e) {
            errors.push("src" + i + ": " + e.message);
        }
    }

    throw new Error(errors.join(" | "));
}

module.exports = {
    name: "ss",
    aliases: ["screenshot", "webss", "ssweb"],

    run: async function ({ sock, from, args, reply, message }) {
        const url = normalizeUrl(args.join(" "));
        if (!url) {
            return reply(
"╭━━〔 📸 VENOM X SS 〕━━⬣\n\n" +
"Usage:\n#ss <url>\n\n" +
"Example:\n#ss https://fast.com\n#ss google.com\n\n" +
"╰━━━━━━━━━━━━━━━━⬣"
            );
        }

        await reply("📸 Capturing:\n" + url);

        try {
            const buf = await capture(url);
            await sock.sendMessage(
                from,
                {
                    image: buf,
                    caption:
                        "╭━━〔 📸 SCREENSHOT 〕━━⬣\n\n" +
                        "🔗 " + url + "\n" +
                        "⚡ VENOM X\n\n" +
                        "╰━━━━━━━━━━━━━━━━⬣"
                },
                { quoted: message }
            );
        } catch (err) {
            return reply("❌ Screenshot failed:\n" + err.message);
        }
    }
};
