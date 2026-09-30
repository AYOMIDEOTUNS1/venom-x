const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const { exec } = require("child_process");
const { promisify } = require("util");
const { downloadContentFromMessage } = require("@whiskeysockets/baileys");

const execAsync = promisify(exec);

function tmp(ext) {
    return path.join(os.tmpdir(), "venom_" + crypto.randomBytes(6).toString("hex") + "." + ext);
}

function unwrap(msg) {
    let cur = msg;
    for (let i = 0; i < 5; i++) {
        const w =
            (cur && cur.ephemeralMessage && cur.ephemeralMessage.message) ||
            (cur && cur.viewOnceMessage && cur.viewOnceMessage.message) ||
            (cur && cur.viewOnceMessageV2 && cur.viewOnceMessageV2.message) ||
            null;
        if (!w) break;
        cur = w;
    }
    return cur;
}

module.exports = {
    name: "bass",
    aliases: ["bassboost", "earrape"],

    run: async function ({ sock, from, message, args, reply }) {
        const ctx =
            message.message &&
            message.message.extendedTextMessage &&
            message.message.extendedTextMessage.contextInfo;

        const quoted = ctx && ctx.quotedMessage ? unwrap(ctx.quotedMessage) : null;
        const audioNode =
            quoted && (quoted.audioMessage || quoted.videoMessage)
                ? quoted.audioMessage || quoted.videoMessage
                : null;

        if (!audioNode) {
            return reply("🎧 Reply to an *audio/video* with *#bass*\nOptional: #bass 20");
        }

        const gain = Math.min(40, Math.max(5, parseInt(args[0], 10) || 15));
        const isVideo = !!(quoted && quoted.videoMessage);
        const input = tmp(isVideo ? "mp4" : "ogg");
        const output = tmp("mp3");

        try {
            await reply("🔊 Bass boosting...");
            const stream = await downloadContentFromMessage(
                audioNode,
                isVideo ? "video" : "audio"
            );
            const chunks = [];
            for await (const c of stream) chunks.push(c);
            fs.writeFileSync(input, Buffer.concat(chunks));

            await execAsync(
                'ffmpeg -hide_banner -loglevel error -y -i "' +
                    input +
                    '" -af "bass=g=' +
                    gain +
                    ':f=110,volume=1.2" -acodec libmp3lame -ab 192k "' +
                    output +
                    '"'
            );

            await sock.sendMessage(
                from,
                {
                    audio: fs.readFileSync(output),
                    mimetype: "audio/mpeg",
                    ptt: false,
                    fileName: "venom-bass.mp3"
                },
                { quoted: message }
            );
        } catch (e) {
            return reply("❌ Bass failed:\n" + e.message);
        } finally {
            try { fs.unlinkSync(input); } catch (e) {}
            try { fs.unlinkSync(output); } catch (e) {}
        }
    }
};
