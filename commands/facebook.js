/**
 * VENOM X - Facebook download
 * #fb <url> | #facebook <url>
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
        "venom_fb_" + crypto.randomBytes(6).toString("hex") + "." + ext
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
        "https://api.siputzx.my.id/api/d/facebook?url=" + encodeURIComponent(url),
        "https://api.agatz.xyz/api/facebook?url=" + encodeURIComponent(url)
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
    throw last || new Error("All FB APIs failed");
}

function pickMedia(data) {
    const d = data.data || data.result || data;
    const candidates = [];

    if (typeof d === "string" && d.startsWith("http")) candidates.push(d);
    if (d.video) candidates.push(d.video);
    if (d.hd) candidates.push(d.hd);
    if (d.sd) candidates.push(d.sd);
    if (d.url) candidates.push(d.url);
    if (d.download) candidates.push(d.download);
    if (d.media) candidates.push(d.media);
    if (Array.isArray(d.medias)) {
        for (let i = 0; i < d.medias.length; i++) {
            const m = d.medias[i];
            if (m && m.url) candidates.push(m.url);
            if (typeof m === "string") candidates.push(m);
        }
    }
    if (Array.isArray(d)) {
        for (let i = 0; i < d.length; i++) {
            if (typeof d[i] === "string") candidates.push(d[i]);
            if (d[i] && d[i].url) candidates.push(d[i].url);
        }
    }

    return candidates.filter(Boolean)[0] || null;
}

module.exports = {
    name: "facebook",
    aliases: ["fb", "fbdl"],

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

        if (!url || !/facebook\.com|fb\.watch|fb\.com/i.test(url)) {
            return reply(
"╭━━〔 📘 VENOM FB 〕━━⬣\n" +
"┃ Usage:\n" +
"┃ #fb <facebook video url>\n" +
"╰━━━━━━━━━━━━━━━━⬣"
            );
        }

        try {
            await reply("📥 Downloading Facebook video...");

            const data = await fetchApis(url);
            const mediaUrl = pickMedia(data);
            if (!mediaUrl) throw new Error("No video URL in API response");

            const bin = await axios.get(mediaUrl, {
                responseType: "arraybuffer",
                timeout: 120000,
                maxContentLength: 80 * 1024 * 1024,
                headers: {
                    "User-Agent":
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0",
                    Referer: "https://www.facebook.com/",
                    Accept: "*/*"
                }
            });

            let buffer = Buffer.from(bin.data);
            if (buffer.length < 5000) throw new Error("File too small / empty");

            buffer = await remuxMp4(buffer);

            await sock.sendMessage(
                from,
                {
                    video: buffer,
                    mimetype: "video/mp4",
                    caption: "📘 *Facebook*\n⚡ VENOM X",
                    fileName: "venom-fb.mp4"
                },
                { quoted: message }
            );
        } catch (e) {
            console.log("FB ERROR:", e.message || e);
            return reply(
"╭━━〔 ❌ FB FAILED 〕━━⬣\n" +
"┃ " + String(e.message || e).slice(0, 200) + "\n" +
"┃ Try another link / public video.\n" +
"╰━━━━━━━━━━━━━━━━⬣"
            );
        }
    }
};
