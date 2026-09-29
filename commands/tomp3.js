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
    name: "tomp3",
    aliases: ["toaudio", "mp3"],

    run: async function ({ sock, from, message, reply }) {
        const ctx =
            message.message &&
            message.message.extendedTextMessage &&
            message.message.extendedTextMessage.contextInfo;

        const quoted = ctx && ctx.quotedMessage ? unwrap(ctx.quotedMessage) : null;
        if (!quoted || !quoted.videoMessage) {
            return reply("🎬 Reply to a video with *#tomp3*");
        }

        const input = tmp("mp4");
        const output = tmp("mp3");

        try {
            await reply("⏳ Converting to MP3...");
            const stream = await downloadContentFromMessage(quoted.videoMessage, "video");
            const chunks = [];
            for await (const c of stream) chunks.push(c);
            fs.writeFileSync(input, Buffer.concat(chunks));

            await execAsync(
                'ffmpeg -hide_banner -loglevel error -y -i "' +
                    input +
                    '" -vn -acodec libmp3lame -ab 192k "' +
                    output +
                    '"'
            );

            const audio = fs.readFileSync(output);
            await sock.sendMessage(
                from,
                {
                    audio: audio,
                    mimetype: "audio/mpeg",
                    fileName: "venom.mp3",
                    ptt: false
                },
                { quoted: message }
            );
        } catch (e) {
            return reply("❌ tomp3 failed:\n" + e.message + "\n\nNeed ffmpeg on server.");
        } finally {
            try { fs.unlinkSync(input); } catch (e) {}
            try { fs.unlinkSync(output); } catch (e) {}
        }
    }
};
