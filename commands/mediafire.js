const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");
const path = require("path");
const os = require("os");

function tmp(name) {
    return path.join(os.tmpdir(), "venom_mf_" + Date.now() + "_" + name);
}

module.exports = {
    name: "mediafire",
    aliases: ["mf", "mfire", "mediafiredl"],

    run: async function ({ sock, from, args, reply, message }) {
        const url = args.join(" ").trim();
        if (!url || url.indexOf("mediafire.com") === -1) {
            return reply(
"╭━━〔 📦 VENOM X MEDIAFIRE 〕━━⬣\n\n" +
"Usage:\n#mediafire <mediafire-link>\n\n" +
"Example:\n#mf https://www.mediafire.com/file/xxxx\n\n" +
"╰━━━━━━━━━━━━━━━━⬣"
            );
        }

        let filePath = null;
        try {
            await reply("⏳ Fetching MediaFire link...");

            const page = await axios.get(url, {
                timeout: 30000,
                headers: {
                    "User-Agent":
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36"
                }
            });

            const $ = cheerio.load(page.data);
            let direct =
                $("#downloadButton").attr("href") ||
                $("a#downloadButton").attr("href") ||
                $("a[href*='download']").attr("href");

            if (!direct) {
                const m = page.data.match(/https?:\/\/download\d+\.mediafire\.com\/[^"'\s]+/);
                if (m) direct = m[0];
            }

            if (!direct) {
                return reply("❌ Could not find download link.");
            }

            const nameGuess =
                $(".filename").first().text().trim() ||
                $("div.filename").text().trim() ||
                "mediafire_file";

            const safeName = nameGuess.replace(/[^\w.\-() ]+/g, "_").slice(0, 80) || "file";

            await reply("⬇️ Downloading:\n" + safeName);

            const res = await axios.get(direct, {
                responseType: "arraybuffer",
                timeout: 120000,
                maxContentLength: 80 * 1024 * 1024,
                headers: {
                    "User-Agent":
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36",
                    Referer: url
                }
            });

            const buffer = Buffer.from(res.data);
            if (buffer.length < 1000) {
                return reply("❌ Download failed (empty file).");
            }

            filePath = tmp(safeName);
            fs.writeFileSync(filePath, buffer);

            await sock.sendMessage(
                from,
                {
                    document: fs.readFileSync(filePath),
                    fileName: safeName,
                    mimetype: "application/octet-stream",
                    caption:
                        "📦 MediaFire download\n" +
                        "📁 " + safeName + "\n" +
                        "💾 " + (buffer.length / (1024 * 1024)).toFixed(2) + " MB\n" +
                        "⚡ VENOM X"
                },
                { quoted: message }
            );
        } catch (err) {
            return reply("❌ MediaFire error:\n" + err.message);
        } finally {
            try {
                if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
            } catch (e) {}
        }
    }
};
