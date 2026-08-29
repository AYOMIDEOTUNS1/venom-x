const { PassThrough } = require("stream");
const { exec } = require("child_process");
const { promisify } = require("util");
const { downloadContentFromMessage } = require("@whiskeysockets/baileys");
const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");

const execAsync = promisify(exec);

const PURPLE_COLOR = "#9C27B0";

function tmp(ext) {
    return path.join(os.tmpdir(), `venom_\( {crypto.randomBytes(6).toString("hex")}. \){ext}`);
}

function detectMediaType(message) {
    if (!message || typeof message !== "object") return null;
    if (message.imageMessage) return "image";
    if (message.videoMessage) return "video";
    if (message.audioMessage) return "audio";
    if (message.stickerMessage) return "sticker";
    return null;
}

function unwrapQuotedMessage(message) {
    let current = message;
    for (let i = 0; i < 4; i++) {
        const wrapper =
            current?.viewOnceMessageV2 ||
            current?.viewOnceMessage ||
            current?.viewOnceMessageV2Extension ||
            current?.documentWithCaptionMessage;
        if (!wrapper?.message) break;
        current = wrapper.message;
    }
    return current;
}

async function downloadMedia(message, type) {
    const mediaMessage = message[`${type}Message`];
    if (!mediaMessage) throw new Error(`Missing ${type} message payload.`);

    const stream = await downloadContentFromMessage(mediaMessage, type);
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    return Buffer.concat(chunks);
}

async function postGroupStatus(sock, jid, content) {
    const statusSourceType = content.text
        ? "TEXT"
        : content.image
            ? "IMAGE"
            : content.video
                ? "VIDEO"
                : content.audio
                    ? "AUDIO"
                    : content.sticker
                        ? "IMAGE"
                        : "TEXT";

    return sock.sendMessage(jid, {
        ...content,
        contextInfo: {
            ...(content.contextInfo || {}),
            isGroupStatus: true,
            statusSourceType,
            statusAttributions: [{ type: 10 }],
            statusAudienceMetadata: { audienceType: "CLOSE_FRIENDS" }
        }
    });
}

async function convertToVoiceNote(buffer) {
    const input = tmp("mp3");
    const output = tmp("ogg");

    try {
        fs.writeFileSync(input, buffer);

        await execAsync(
            `ffmpeg -y -i "\( {input}" -vn -c:a libopus -b:a 64k -ar 48000 -ac 1 " \){output}"`
        );

        return fs.readFileSync(output);
    } finally {
        try { fs.unlinkSync(input); } catch {}
        try { fs.unlinkSync(output); } catch {}
    }
}

module.exports = {
    name: "status2",
    aliases: ["gcstatus", "gstatus", "groupstatus"],

    run: async ({ sock, from, message, args, reply, isGroup }) => {

        if (!isGroup) {
            return reply("❌ This command can only be used in groups.");
        }

        const caption = args.join(" ").trim();

        const quotedMessage =
            message.message?.extendedTextMessage?.contextInfo?.quotedMessage ||
            message.message?.imageMessage?.contextInfo?.quotedMessage ||
            message.message?.videoMessage?.contextInfo?.quotedMessage;

        // ── Text status
        if (!quotedMessage) {
            if (!caption) {
                return reply(
`╭━━〔 📝 VENOM X GROUP STATUS 〕━━⬣

• Reply to an image, video, audio or sticker:
  #status2 [optional caption]

• Post a text status:
  #status2 Your text here

Aliases: #gcstatus #gstatus #groupstatus

╰━━━━━━━━━━━━━━━━⬣`
                );
            }

            await reply("⏳ Posting text group status...");
            try {
                await postGroupStatus(sock, from, {
                    text: caption,
                    backgroundColor: PURPLE_COLOR
                });
                return reply("✅ Text group story posted successfully.");
            } catch (error) {
                console.error("[GroupStatus] text error:", error);
                return reply(`❌ Failed to post text group story: ${error.message || error}`);
            }
        }

        // ── Quoted media
        const mediaPayload = unwrapQuotedMessage(quotedMessage);
        const mediaType = detectMediaType(mediaPayload);

        if (!mediaType) {
            return reply("❌ Unsupported media. Reply to an image, video, audio, or sticker.");
        }

        await reply(`⏳ Preparing ${mediaType} group status...`);

        try {
            const buffer = await downloadMedia(mediaPayload, mediaType);
            if (!buffer?.length) throw new Error("Could not download the media.");

            if (mediaType === "audio") {
                const voiceNote = await convertToVoiceNote(buffer);

                await postGroupStatus(sock, from, {
                    audio: voiceNote,
                    mimetype: "audio/ogg; codecs=opus",
                    ptt: true
                });
            } else if (mediaType === "sticker") {
                await postGroupStatus(sock, from, {
                    sticker: buffer
                });
            } else {
                await postGroupStatus(sock, from, {
                    [mediaType]: buffer,
                    caption: caption || ""
                });
            }

            return reply(`✅ ${mediaType[0].toUpperCase() + mediaType.slice(1)} group story posted successfully.`);

        } catch (error) {
            console.error(`[GroupStatus] ${mediaType} error:`, error);
            return reply(`❌ Failed to post ${mediaType} group story: ${error.message || error}`);
        }
    }
};
