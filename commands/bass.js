/**
 * VENOM X - #bass
 * Reply to voice note / audio / video
 */

const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const { exec } = require("child_process");
const { promisify } = require("util");
const { downloadContentFromMessage } = require("@whiskeysockets/baileys");

const execAsync = promisify(exec);

function tmp(ext) {
    return path.join(
        os.tmpdir(),
        "venom_bass_" + crypto.randomBytes(6).toString("hex") + "." + ext
    );
}

function unwrap(msg) {
    let cur = msg;
    for (let i = 0; i < 8; i++) {
        if (!cur || typeof cur !== "object") break;
        const wrap =
            (cur.ephemeralMessage && cur.ephemeralMessage.message) ||
            (cur.viewOnceMessage && cur.viewOnceMessage.message) ||
            (cur.viewOnceMessageV2 && cur.viewOnceMessageV2.message) ||
            (cur.viewOnceMessageV2Extension && cur.viewOnceMessageV2Extension.message) ||
            (cur.documentWithCaptionMessage && cur.documentWithCaptionMessage.message) ||
            null;
        if (!wrap) break;
        cur = wrap;
    }
    return cur;
}

function getQuotedRoot(message) {
    const m = message.message || {};
    const candidates = [
        m.extendedTextMessage && m.extendedTextMessage.contextInfo,
        m.imageMessage && m.imageMessage.contextInfo,
        m.videoMessage && m.videoMessage.contextInfo,
        m.audioMessage && m.audioMessage.contextInfo,
        m.documentMessage && m.documentMessage.contextInfo,
        m.buttonsResponseMessage && m.buttonsResponseMessage.contextInfo,
        m.templateButtonReplyMessage && m.templateButtonReplyMessage.contextInfo,
        m.listResponseMessage && m.listResponseMessage.contextInfo
    ];

    for (let i = 0; i < candidates.length; i++) {
        const ctx = candidates[i];
        if (ctx && ctx.quotedMessage) {
            return unwrap(ctx.quotedMessage);
        }
    }
    return null;
}

function findMedia(node) {
    if (!node) return null;

    if (node.audioMessage) {
        return { type: "audio", msg: node.audioMessage, ext: "ogg" };
    }
    if (node.videoMessage) {
        return { type: "video", msg: node.videoMessage, ext: "mp4" };
    }
    if (node.documentMessage) {
        const mime = String(node.documentMessage.mimetype || "");
        if (mime.indexOf("audio") !== -1 || mime.indexOf("video") !== -1) {
            return {
                type: mime.indexOf("video") !== -1 ? "video" : "audio",
                msg: node.documentMessage,
                ext: mime.indexOf("video") !== -1 ? "mp4" : "mp3"
            };
        }
    }
    return null;
}

module.exports = {
    name: "bass",
    aliases: ["bassboost", "earrape"],

    run: async function ({ sock, from, message, args, reply }) {
        const quoted = getQuotedRoot(message);
        const media = findMedia(quoted);

        if (!media) {
            return reply(
"╭━━〔 🔊 VENOM BASS 〕━━⬣\n" +
"┃\n" +
"┃ Reply to a *voice note*, *audio*,\n" +
"┃ or *video* then type:\n" +
"┃\n" +
"┃ #bass\n" +
"┃ #bass 20\n" +
"┃\n" +
"╰━━━━━━━━━━━━━━━━⬣"
            );
        }

        const gain = Math.min(40, Math.max(5, parseInt(args[0], 10) || 15));
        const input = tmp(media.ext);
        const output = tmp("mp3");

        try {
            await reply("🔊 Bass boosting (" + gain + ")...");

            // document download type still uses document in some baileys versions
            let dlType = media.type;
            if (quoted.documentMessage) dlType = "document";

            const stream = await downloadContentFromMessage(media.msg, dlType);
            const chunks = [];
            for await (const c of stream) chunks.push(c);
            const buffer = Buffer.concat(chunks);

            if (!buffer.length) throw new Error("Downloaded audio is empty");

            fs.writeFileSync(input, buffer);

            await execAsync(
                'ffmpeg -hide_banner -loglevel error -y -i "' +
                    input +
                    '" -af "bass=g=' +
                    gain +
                    ':f=110,volume=1.15" -vn -acodec libmp3lame -ab 192k "' +
                    output +
                    '"'
            );

            const out = fs.readFileSync(output);
            if (!out.length) throw new Error("FFmpeg produced empty file");

            await sock.sendMessage(
                from,
                {
                    audio: out,
                    mimetype: "audio/mpeg",
                    ptt: false,
                    fileName: "venom-bass.mp3"
                },
                { quoted: message }
            );
        } catch (e) {
            console.log("BASS ERROR:", e.message || e);
            return reply(
                "❌ Bass failed:\n" +
                    String(e.message || e).slice(0, 220) +
                    "\n\nMake sure ffmpeg is installed and you replied to the audio."
            );
        } finally {
            try { fs.unlinkSync(input); } catch (e) {}
            try { fs.unlinkSync(output); } catch (e) {}
        }
    }
};
