/**
 * VENOM X - Instagram download
 * #ig <url> | #instagram <url>
 */

const axios = require("axios");
const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const { exec } = require("child_process");
const { promisify } = require("util");
const execAsync = promisify(exec);

function tmp(ext) {
    return path.join(
        os.tmpdir(),
        "venom_ig_" + crypto.randomBytes(6).toString("hex") + "." + ext
    );
}

function pickUrl(text) {
    const m = String(text || "").match(/(https?:\/\/[^\s]+)/i);
    return m ? m[0] : "";
}

async function remuxMp4(inputBuf) {
    const inn = tmp("bin");
    const out = tmp("mp4");
    fs.writeFileSync(inn, inputBuf);
    try {
        await execAsync(
            'ffmpeg -hide_banner -loglevel error -y -i "' +
                inn +
                '" -c copy -movflags +faststart "' +
                out +
                '"'
        );
        const buf = fs.readFileSync(out);
        if (buf.length > 1000) return buf;
    } catch (e) {
        try {
            await execAsync(
                'ffmpeg -hide_banner -loglevel error -y -i "' +
                    inn +
                    '" -c:v libx264 -c:a aac -movflags +faststart "' +
                    out +
                    '"'
            );
            const buf = fs.readFileSync(out);
            if (buf.length > 1000) return buf;
        } catch (e2) {}
    } finally {
        try { fs.unlinkSync(inn); } catch (e) {}
        try { fs.unlinkSync(out); } catch (e) {}
    }
    return inputBuf;
}

async function fetchApis(url) {
    const list = [
        "https://api.siputzx.my.id/api/d/igdl?url=" + encodeURIComponent(url),
        "https://api.agatz.xyz/api/instagram?url=" + encodeURIComponent(url)
    ];
    let last = null;
    for (let i = 0; i < list.length; i++) {
        try {
            const { data } = await axios.get(list[i], {
                timeout: 45000,
                headers: { "User-Agent": "VENOM-X" }
            });
            if (data) return data;
        } catch (e) {
            last = e;
        }
    }
    throw last || new Error("All IG APIs failed");
}

function pickItems(data) {
    const d = data.data || data.result || data;
    const urls = [];

    if (Array.isArray(d)) {
        for (let i = 0; i < d.length; i++) {
            if (typeof d[i] === "string") urls.push(d[i]);
            else if (d[i] && d[i].url) urls.push(d[i].url);
            else if (d[i] && d[i].download) urls.push(d[i].download);
        }
    } else if (d) {
        if (d.url) urls.push(d.url);
        if (d.video) urls.push(d.video);
        if (d.media) urls.push(d.media);
        if (Array.isArray(d.medias)) {
            for (let i = 0; i < d.medias.length; i++) {
                if (d.medias[i] && d.medias[i].url) urls.push(d.medias[i].url);
            }
        }
        if (Array.isArray(d.images)) {
            for (let i = 0; i < d.images.length; i++) urls.push(d.images[i]);
        }
    }
    return urls.filter(Boolean);
}

module.exports = {
    name: "instagram",
    aliases: ["ig", "igdl", "insta"],

    run: async function ({ sock, from, args, reply, message }) {
        let url = pickUrl((args || []).join(" "));
        if (!url) {
            const ctx =
                message.message &&
                message.message.extendedTextMessage &&
                message.message.extendedTextMessage.contextInfo;
            const q = ctx && ctx.quotedMessage;
            if (q) {
                url = pickUrl(
                    q.conversation ||
                        (q.extendedTextMessage && q.extendedTextMessage.text) ||
                        ""
                );
            }
        }

        if (!url || !/instagram\.com|instagr\.am/i.test(url)) {
            return reply(
"╭━━〔 📸 VENOM IG 〕━━⬣\n" +
"┃ Usage:\n" +
"┃ #ig <instagram url>\n" +
"╰━━━━━━━━━━━━━━━━⬣"
            );
        }

        try {
            await reply("📥 Downloading Instagram media...");

            const data = await fetchApis(url);
            const items = pickItems(data);
            if (!items.length) throw new Error("No media URL found");

            // send up to 3 items
            for (let i = 0; i < Math.min(items.length, 3); i++) {
                const mediaUrl = items[i];
                const bin = await axios.get(mediaUrl, {
                    responseType: "arraybuffer",
                    timeout: 120000,
                    maxContentLength: 80 * 1024 * 1024,
                    headers: {
                        "User-Agent":
                            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0",
                        Referer: "https://www.instagram.com/",
                        Accept: "*/*"
                    }
                });

                let buffer = Buffer.from(bin.data);
                if (buffer.length < 1000) continue;

                const isJpg =
                    buffer[0] === 0xff && buffer[1] === 0xd8;
                const isPng =
                    buffer[0] === 0x89 && buffer[1] === 0x50;

                if (isJpg || isPng) {
                    await sock.sendMessage(
                        from,
                        {
                            image: buffer,
                            caption: "📸 *Instagram*\n⚡ VENOM X"
                        },
                        { quoted: message }
                    );
                } else {
                    buffer = await remuxMp4(buffer);
                    await sock.sendMessage(
                        from,
                        {
                            video: buffer,
                            mimetype: "video/mp4",
                            caption: "📸 *Instagram*\n⚡ VENOM X",
                            fileName: "venom-ig.mp4"
                        },
                        { quoted: message }
                    );
                }
            }
        } catch (e) {
            console.log("IG ERROR:", e.message || e);
            return reply(
"╭━━〔 ❌ IG FAILED 〕━━⬣\n" +
"┃ " + String(e.message || e).slice(0, 200) + "\n" +
"┃ Private / restricted posts may fail.\n" +
"╰━━━━━━━━━━━━━━━━⬣"
            );
        }
    }
};
