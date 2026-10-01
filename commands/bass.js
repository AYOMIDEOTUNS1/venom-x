/**
 * VENOM X - #bass (strong quote detection)
 * Reply to voice note / audio / video → bass boost
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
    for (let i = 0; i < 10; i++) {
        if (!cur || typeof cur !== "object") break;
        const wrap =
            (cur.ephemeralMessage && cur.ephemeralMessage.message) ||
            (cur.viewOnceMessage && cur.viewOnceMessage.message) ||
            (cur.viewOnceMessageV2 && cur.viewOnceMessageV2.message) ||
            (cur.viewOnceMessageV2Extension &&
                cur.viewOnceMessageV2Extension.message) ||
            (cur.documentWithCaptionMessage &&
                cur.documentWithCaptionMessage.message) ||
            (cur.viewOnceMessageV2Extension &&
                cur.viewOnceMessageV2Extension.message) ||
            null;
        if (!wrap) break;
        cur = wrap;
    }
    return cur || {};
}

function walkFindMedia(node, depth) {
    if (!node || typeof node !== "object" || depth > 8) return null;

    if (node.audioMessage) {
        return { kind: "audio", media: node.audioMessage };
    }
    if (node.videoMessage) {
        return { kind: "video", media: node.videoMessage };
    }
    if (node.documentMessage) {
        const mime = String(node.documentMessage.mimetype || "");
        if (mime.includes("audio") || mime.includes("video") || mime.includes("ogg")) {
            return {
                kind: mime.includes("video") ? "video" : "audio",
                media: node.documentMessage,
                asDocument: true
            };
        }
    }

    const keys = Object.keys(node);
    for (let i = 0; i < keys.length; i++) {
        const v = node[keys[i]];
        if (v && typeof v === "object") {
            const hit = walkFindMedia(v, depth + 1);
            if (hit) return hit;
        }
    }
    return null;
}

function getQuotedMessage(message) {
    const root = message.message || {};
    const unwrapped = unwrap(root);

    // common reply locations
    const contexts = [];
    const bag = [root, unwrapped];

    for (let b = 0; b < bag.length; b++) {
        const m = bag[b];
        if (!m || typeof m !== "object") continue;
        const keys = Object.keys(m);
        for (let i = 0; i < keys.length; i++) {
            const part = m[keys[i]];
            if (part && part.contextInfo && part.contextInfo.quotedMessage) {
                contexts.push(part.contextInfo);
            }
        }
        if (m.contextInfo && m.contextInfo.quotedMessage) {
            contexts.push(m.contextInfo);
        }
    }

    for (let i = 0; i < contexts.length; i++) {
        const q = unwrap(contexts[i].quotedMessage);
        const media = walkFindMedia(q, 0);
        if (media) return media;
    }

    // sometimes people send command as caption on media (rare)
    const direct = walkFindMedia(unwrapped, 0);
    if (direct) return direct;

    return null;
}

async function downloadMedia(mediaObj) {
    const kind = mediaObj.asDocument
        ? "document"
        : mediaObj.kind; // audio | video | document

    const stream = await downloadContentFromMessage(mediaObj.media, kind);
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    const buffer = Buffer.concat(chunks);
    if (!buffer.length) throw new Error("Downloaded media is empty");
    return buffer;
}

async function hasFfmpeg() {
    try {
        await execAsync("ffmpeg -version");
        return true;
    } catch (e) {
        return false;
    }
}

module.exports = {
    name: "bass",
    aliases: ["bassboost", "earrape"],

    run: async function ({ sock, from, message, args, reply }) {
        const found = getQuotedMessage(message);

        if (!found) {
            return reply(
"╭━━〔 🔊 VENOM BASS 〕━━⬣\n" +
"┃\n" +
"┃ Reply to a *voice note* / *audio*\n" +
"┃ or *video*, then send:\n" +
"┃\n" +
"┃ #bass\n" +
"┃ #bass 20\n" +
"┃\n" +
"┃ Tip: long-press the audio → Reply\n" +
"┃ then type #bass\n" +
"┃\n" +
"╰━━━━━━━━━━━━━━━━⬣"
            );
        }

        if (!(await hasFfmpeg())) {
            return reply(
"❌ ffmpeg is not installed on this server.\n" +
"Install ffmpeg, then restart the bot."
            );
        }

        const gain = Math.min(40, Math.max(5, parseInt(args[0], 10) || 15));
        const input = tmp(found.kind === "video" ? "mp4" : "ogg");
        const output = tmp("mp3");

        try {
            await reply("🔊 Bass boosting (" + gain + ")...");

            const buffer = await downloadMedia(found);
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
            if (!out.length) throw new Error("Empty ffmpeg output");

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
                    String(e.message || e).slice(0, 250)
            );
        } finally {
            try { fs.unlinkSync(input); } catch (e) {}
            try { fs.unlinkSync(output); } catch (e) {}
        }
    }
};
