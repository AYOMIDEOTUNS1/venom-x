/**
 * VENOM X - #get
 * Fetch URL → status / type / preview
 * Sends: image, audio/mp3, video, documents (pdf, zip, etc.)
 */

"use strict";

const axios = require("axios");
const path = require("path");

function pickUrl(text) {
    const m = String(text || "").match(/(https?:\/\/[^\s<>"']+)/i);
    return m ? m[0].replace(/[),.;]+$/, "") : null;
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
    if (type.indexOf("pdf") !== -1) return "PDF";
    if (type.indexOf("zip") !== -1 || type.indexOf("rar") !== -1) return "ARCHIVE";
    return "OTHER";
}

function isImageType(type, url) {
    type = String(type || "").toLowerCase();
    if (type.indexOf("image/") !== -1) return true;
    return /\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?|$)/i.test(String(url || ""));
}

function isAudioType(type, url) {
    type = String(type || "").toLowerCase();
    if (type.indexOf("audio/") !== -1) return true;
    if (type.indexOf("mpeg") !== -1 && /\.mp3/i.test(url || "")) return true;
    return /\.(mp3|m4a|ogg|opus|wav|aac|flac)(\?|$)/i.test(String(url || ""));
}

function isVideoType(type, url) {
    type = String(type || "").toLowerCase();
    if (type.indexOf("video/") !== -1) return true;
    return /\.(mp4|mkv|webm|mov|3gp|avi)(\?|$)/i.test(String(url || ""));
}

function isDocType(type, url) {
    type = String(type || "").toLowerCase();
    if (
        type.indexOf("application/pdf") !== -1 ||
        type.indexOf("application/zip") !== -1 ||
        type.indexOf("application/x-rar") !== -1 ||
        type.indexOf("application/vnd") !== -1 ||
        type.indexOf("application/msword") !== -1 ||
        type.indexOf("application/octet-stream") !== -1
    ) {
        return true;
    }
    return /\.(pdf|zip|rar|7z|doc|docx|xls|xlsx|ppt|pptx|apk|txt|csv)(\?|$)/i.test(
        String(url || "")
    );
}

function audioMime(type, url) {
    type = String(type || "").toLowerCase();
    if (type.indexOf("audio/") === 0 && type.indexOf(";") === -1) return type;
    if (type.indexOf("audio/mpeg") !== -1 || /\.mp3/i.test(url || "")) {
        return "audio/mpeg";
    }
    if (type.indexOf("ogg") !== -1 || /\.ogg/i.test(url || "")) {
        return "audio/ogg";
    }
    if (type.indexOf("mp4") !== -1 || /\.m4a/i.test(url || "")) {
        return "audio/mp4";
    }
    if (type.indexOf("wav") !== -1) return "audio/wav";
    return "audio/mpeg";
}

function videoMime(type, url) {
    type = String(type || "").toLowerCase();
    if (type.indexOf("video/") === 0) return type.split(";")[0].trim();
    if (/\.webm/i.test(url || "")) return "video/webm";
    if (/\.mkv/i.test(url || "")) return "video/x-matroska";
    return "video/mp4";
}

function fileNameFromUrl(url, fallback) {
    try {
        const u = new URL(url);
        let name = path.basename(u.pathname || "");
        name = decodeURIComponent(name).replace(/[^\w.\-()+\s]/g, "_");
        if (name && name !== "/" && name.indexOf(".") !== -1) return name.slice(0, 80);
    } catch (e) {}
    return fallback || "file.bin";
}

function docMime(type, url) {
    type = String(type || "").toLowerCase().split(";")[0].trim();
    if (type && type !== "application/octet-stream") return type;
    if (/\.pdf/i.test(url || "")) return "application/pdf";
    if (/\.zip/i.test(url || "")) return "application/zip";
    if (/\.apk/i.test(url || "")) return "application/vnd.android.package-archive";
    if (/\.txt/i.test(url || "")) return "text/plain";
    return type || "application/octet-stream";
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
    // strip null bytes from binary mistaken as text
    if (text.indexOf("\u0000") !== -1) {
        return "[binary content]";
    }
    if (text.length > 900) {
        text = text.slice(0, 900) + "\n\n...TRUNCATED";
    }
    return text;
}

function formatSize(n) {
    n = Number(n) || 0;
    if (n < 1024) return n + " B";
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
    return (n / (1024 * 1024)).toFixed(2) + " MB";
}

const MAX_BYTES = 50 * 1024 * 1024; // 50MB

module.exports = {
    name: "get",
    aliases: ["fetch", "httpget", "curl"],

    run: async function ({ sock, from, args, reply, message }) {
        const input = (args || []).join(" ").trim();
        const url = pickUrl(input);

        if (!url) {
            return reply(
`╭━━〔 🌐 VENOM GET 〕━━⬣
┃
┃ Usage:
┃ #get https://example.com
┃
┃ Auto-sends:
┃ • Images (jpg/png/webp…)
┃ • Audio (mp3/m4a/ogg…)
┃ • Video (mp4/webm…)
┃ • Files (pdf/zip/apk…)
┃
╰━━━━━━━━━━━━━━━━⬣`
            );
        }

        try {
            await reply("🌐 Fetching...");

            const start = Date.now();
            const res = await axios.get(url, {
                timeout: 60000,
                maxRedirects: 5,
                responseType: "arraybuffer",
                maxContentLength: MAX_BYTES,
                maxBodyLength: MAX_BYTES,
                validateStatus: function () {
                    return true;
                },
                headers: {
                    "User-Agent":
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
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
"┃ 📏 Size   : " + formatSize(buf.length) + "\n" +
"┃\n" +
"╰━━━━━━━━━━━━━━━━⬣";

            if (res.status < 200 || res.status >= 400) {
                return reply(
                    caption.replace(
                        "╰━━━━━━━━━━━━━━━━⬣",
                        "┃ ❌ Bad status\n╰━━━━━━━━━━━━━━━━⬣"
                    )
                );
            }

            if (!buf.length) {
                return reply(caption);
            }

            // ── IMAGE
            if (isImageType(type, url) && buf.length > 200) {
                return sock.sendMessage(
                    from,
                    { image: buf, caption: caption },
                    { quoted: message }
                );
            }

            // ── AUDIO / MP3
            if (isAudioType(type, url) && buf.length > 500) {
                const mime = audioMime(type, url);
                const fileName = fileNameFromUrl(url, "audio.mp3");
                await sock.sendMessage(
                    from,
                    {
                        audio: buf,
                        mimetype: mime,
                        fileName: fileName,
                        ptt: false
                    },
                    { quoted: message }
                );
                return reply(caption);
            }

            // ── VIDEO
            if (isVideoType(type, url) && buf.length > 1000) {
                const mime = videoMime(type, url);
                return sock.sendMessage(
                    from,
                    {
                        video: buf,
                        mimetype: mime,
                        caption: caption,
                        fileName: fileNameFromUrl(url, "video.mp4")
                    },
                    { quoted: message }
                );
            }

            // ── DOCUMENT (pdf, zip, apk, etc.)
            if (isDocType(type, url) && buf.length > 100) {
                const mime = docMime(type, url);
                const fileName = fileNameFromUrl(
                    url,
                    mime.indexOf("pdf") !== -1 ? "file.pdf" : "file.bin"
                );
                return sock.sendMessage(
                    from,
                    {
                        document: buf,
                        mimetype: mime,
                        fileName: fileName,
                        caption: caption
                    },
                    { quoted: message }
                );
            }

            // ── TEXT / HTML / JSON preview
            const body = previewBody(buf);
            if (body === "[binary content]") {
                // unknown binary → send as document
                return sock.sendMessage(
                    from,
                    {
                        document: buf,
                        mimetype: "application/octet-stream",
                        fileName: fileNameFromUrl(url, "download.bin"),
                        caption: caption
                    },
                    { quoted: message }
                );
            }

            return reply(
                caption.replace(
                    "╰━━━━━━━━━━━━━━━━⬣",
                    "┃ 📄 Preview\n┃ " +
                        body.split("\n").join("\n┃ ") +
                        "\n┃\n╰━━━━━━━━━━━━━━━━⬣"
                )
            );
        } catch (e) {
            let err = e.message || String(e);
            if (/maxcontentlength|max body/i.test(err)) {
                err = "File too large (max 50MB)";
            }
            return reply(
"╭━━〔 ❌ VENOM FETCH 〕━━⬣\n" +
"┃\n" +
"┃ 🔗 " + url + "\n" +
"┃\n" +
"┃ ❌ " + err + "\n" +
"┃\n" +
"╰━━━━━━━━━━━━━━━━⬣"
            );
        }
    }
};
