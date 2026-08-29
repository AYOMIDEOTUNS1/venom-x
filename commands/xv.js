const fs = require("fs");
const path = require("path");
const os = require("os");
const axios = require("axios");
const cheerio = require("cheerio");

function tmpFile(ext) {
    return path.join(os.tmpdir(), "venom_xv_" + Date.now() + "_" + Math.floor(Math.random() * 9999) + "." + ext);
}

async function searchXVideos(query) {
    const url = "https://www.xvideos.com/?k=" + encodeURIComponent(query);
    const res = await axios.get(url, {
        timeout: 12000,
        headers: {
            "User-Agent": "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36"
        }
    });

    const $ = cheerio.load(res.data);
    let best = null;

    $(".frame-block, .thumb-block").each(function (_, el) {
        if (best) return;
        const a = $(el).find("a").first();
        const href = a.attr("href") || "";
        if (!href || href.indexOf("/video") === -1) return;

        const title = (a.attr("title") || $(el).find(".title a").text() || "Video").replace(/\s+/g, " ").trim();
        const duration = ($(el).find(".duration").first().text() || "").trim();
        const full = href.indexOf("http") === 0 ? href : "https://www.xvideos.com" + href;
        best = { title: title, url: full, duration: duration };
    });

    return best;
}

function extractMp4(html) {
    const patterns = [
        /setVideoUrlHigh\('([^']+)'\)/i,
        /setVideoUrlLow\('([^']+)'\)/i,
        /html5player\.setVideoUrlHigh\('([^']+)'\)/i,
        /html5player\.setVideoUrlLow\('([^']+)'\)/i
    ];

    for (let i = 0; i < patterns.length; i++) {
        const m = html.match(patterns[i]);
        if (m && m[1]) return m[1].replace(/\\u0026/g, "&");
    }
    return null;
}

async function downloadMp4(fileUrl, outPath) {
    const res = await axios.get(fileUrl, {
        responseType: "stream",
        timeout: 90000,
        maxRedirects: 5,
        headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36",
            Referer: "https://www.xvideos.com/"
        }
    });

    await new Promise(function (resolve, reject) {
        const ws = fs.createWriteStream(outPath);
        res.data.pipe(ws);
        ws.on("finish", resolve);
        ws.on("error", reject);
        res.data.on("error", reject);
    });

    if (!fs.existsSync(outPath) || fs.statSync(outPath).size < 20000) {
        throw new Error("Download failed");
    }
    return outPath;
}

module.exports = {
    name: "xv",
    aliases: ["xvideos", "xvideo"],

    run: async function ({ sock, from, args, reply, message }) {
        const query = args.join(" ").trim();
        if (!query) {
            return reply("Usage:\n#xv <search>\nExample:\n#xv amateur");
        }

        let videoPath = null;

        try {
            // minimal status only
            await reply("⚡ Fetching...");

            const item = await searchXVideos(query);
            if (!item) return reply("❌ No results.");

            const page = await axios.get(item.url, {
                timeout: 15000,
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36",
                    Referer: "https://www.xvideos.com/"
                }
            });

            const mp4 = extractMp4(page.data);
            if (!mp4) return reply("❌ Could not extract video.\n" + item.url);

            videoPath = tmpFile("mp4");
            await downloadMp4(mp4, videoPath);

            const size = fs.statSync(videoPath).size;
            if (size > 95 * 1024 * 1024) {
                return reply("❌ Too large for WhatsApp.\n" + item.url);
            }

            await sock.sendMessage(
                from,
                {
                    video: fs.readFileSync(videoPath),
                    mimetype: "video/mp4",
                    caption: "🎬 " + item.title + (item.duration ? "\n⏱️ " + item.duration : "")
                },
                { quoted: message }
            );
        } catch (err) {
            console.log("XV ERROR:", err.message);
            return reply("❌ XV failed:\n" + err.message);
        } finally {
            try { if (videoPath && fs.existsSync(videoPath)) fs.unlinkSync(videoPath); } catch (e) {}
        }
    }
};
