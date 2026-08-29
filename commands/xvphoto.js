const axios = require("axios");
const cheerio = require("cheerio");

async function searchXVideosPhotos(query, limit) {
    const url = "https://www.xvideos.com/?k=" + encodeURIComponent(query);
    const res = await axios.get(url, {
        timeout: 20000,
        headers: {
            "User-Agent":
                "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36",
            "Accept-Language": "en-US,en;q=0.9"
        }
    });

    const $ = cheerio.load(res.data);
    const out = [];

    $(".frame-block, .thumb-block").each(function (_, el) {
        if (out.length >= limit) return;

        const a = $(el).find("a").first();
        const href = a.attr("href") || "";
        const title = (a.attr("title") || $(el).find(".title a").text() || "Untitled")
            .replace(/\s+/g, " ")
            .trim();

        let thumb =
            $(el).find("img").attr("data-src") ||
            $(el).find("img").attr("data-srcset") ||
            $(el).find("img").attr("src") ||
            null;

        if (!thumb) return;
        if (thumb.indexOf("//") === 0) thumb = "https:" + thumb;

        // skip tiny placeholders
        if (thumb.indexOf("data:image") === 0) return;

        const page = href
            ? (href.indexOf("http") === 0 ? href : "https://www.xvideos.com" + href)
            : null;

        out.push({
            title: title,
            thumb: thumb,
            url: page
        });
    });

    return out;
}

module.exports = {
    name: "xvphoto",
    aliases: ["xvpics", "xvimg", "xvimages"],

    run: async function ({ sock, from, args, reply, message }) {
        const query = args.join(" ").trim();

        if (!query) {
            return reply(
"╭━━〔 🔞 VENOM X XV PHOTO 〕━━⬣\n\n" +
"Usage:\n" +
"#xvphoto <search>\n\n" +
"Example:\n" +
"#xvphoto Mia Khalifa\n\n" +
"Sends up to 5 photos.\n\n" +
"╰━━━━━━━━━━━━━━━━⬣"
            );
        }

        await reply("🔍 Searching photos: *" + query + "*");

        try {
            const results = await searchXVideosPhotos(query, 5);

            if (!results.length) {
                return reply("❌ No photos found.");
            }

            await reply("📸 Found " + results.length + " photo(s). Sending...");

            for (let i = 0; i < results.length; i++) {
                const item = results[i];
                try {
                    await sock.sendMessage(
                        from,
                        {
                            image: { url: item.thumb },
                            caption:
"╭━━〔 🔞 VENOM X XV PHOTO 〕━━⬣\n\n" +
"🖼️ " + (i + 1) + "/" + results.length + "\n" +
"📝 " + item.title + "\n" +
(item.url ? "🔗 " + item.url + "\n" : "") +
"\n⚡ Powered by VENOM X\n\n" +
"╰━━━━━━━━━━━━━━━━⬣"
                        },
                        { quoted: message }
                    );
                } catch (e) {
                    console.log("XVPHOTO SEND ERROR:", e.message);
                }
            }
        } catch (err) {
            console.log("XVPHOTO ERROR:", err.message);
            return reply(
"╭━━〔 ❌ VENOM X XV PHOTO 〕━━⬣\n\n" +
"Failed.\n" +
err.message + "\n\n" +
"╰━━━━━━━━━━━━━━━━⬣"
            );
        }
    }
};
