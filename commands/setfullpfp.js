/**
 * VENOM X - Set Full Profile Picture
 * Reply to an image → set as bot profile photo
 * Owner only
 */

const sharp = require("sharp");
const axios = require("axios");
const {
    downloadContentFromMessage,
    jidNormalizedUser
} = require("@whiskeysockets/baileys");

function unwrap(message) {
    let current = message || {};
    for (let i = 0; i < 6; i++) {
        const inner =
            (current.ephemeralMessage && current.ephemeralMessage.message) ||
            (current.viewOnceMessage && current.viewOnceMessage.message) ||
            (current.viewOnceMessageV2 && current.viewOnceMessageV2.message) ||
            (current.viewOnceMessageV2Extension &&
                current.viewOnceMessageV2Extension.message) ||
            (current.documentWithCaptionMessage &&
                current.documentWithCaptionMessage.message) ||
            null;
        if (!inner) break;
        current = inner;
    }
    return current;
}

function getImageMessage(message) {
    const root = unwrap(message.message || {});

    // quoted image
    const ctx =
        (root.extendedTextMessage && root.extendedTextMessage.contextInfo) ||
        (root.imageMessage && root.imageMessage.contextInfo) ||
        null;

    if (ctx && ctx.quotedMessage) {
        const quoted = unwrap(ctx.quotedMessage);
        if (quoted.imageMessage) return quoted.imageMessage;
    }

    // direct image with caption command
    if (root.imageMessage) return root.imageMessage;

    return null;
}

async function downloadImage(imageMessage) {
    const stream = await downloadContentFromMessage(imageMessage, "image");
    const chunks = [];
    let bytes = 0;

    for await (const chunk of stream) {
        bytes += chunk.length;
        if (bytes > 20 * 1024 * 1024) {
            throw new Error("Maximum image size is 20 MB.");
        }
        chunks.push(chunk);
    }

    const buf = Buffer.concat(chunks);
    if (!buf.length) throw new Error("Downloaded image is empty.");
    return buf;
}

module.exports = {
    name: "setfullpfp",
    aliases: ["setpfp", "fullpfp", "botpfp", "setpp"],

    run: async function ({ sock, message, reply, isOwner, isPrivileged }) {
        if (!(isOwner || isPrivileged)) {
            return reply("👑 Owner / Sudo only.");
        }

        let pfpUploaded = false;

        try {
            const image = getImageMessage(message);
            if (!image) {
                return reply(
"╭━━〔 🖼️ VENOM SET PFP 〕━━⬣\n" +
"┃\n" +
"┃ Reply to an image:\n" +
"┃ #setfullpfp\n" +
"┃\n" +
"┃ Aliases:\n" +
"┃ #setpfp #fullpfp #botpfp\n" +
"┃\n" +
"╰━━━━━━━━━━━━━━━━⬣"
                );
            }

            await reply("⏳ Processing profile photo...");

            const original = await downloadImage(image);

            const result = await sharp(original, {
                limitInputPixels: 40000000
            })
                .rotate()
                .resize({
                    width: 720,
                    height: 720,
                    fit: "inside"
                })
                .flatten({ background: "#ffffff" })
                .jpeg({ quality: 95 })
                .toBuffer({ resolveWithObject: true });

            const picture = result.data;
            const info = result.info;

            await sock.query({
                tag: "iq",
                attrs: {
                    to: "s.whatsapp.net",
                    type: "set",
                    xmlns: "w:profile:picture"
                },
                content: [
                    {
                        tag: "picture",
                        attrs: { type: "image" },
                        content: picture
                    }
                ]
            });

            pfpUploaded = true;

            // small wait then verify
            await new Promise(function (r) {
                setTimeout(r, 2000);
            });

            const me = jidNormalizedUser(sock.user.id);
            const photoURL = await sock.profilePictureUrl(me, "image");

            if (!photoURL) {
                throw new Error("No profile-photo URL returned for verification.");
            }

            const response = await axios.get(photoURL, {
                responseType: "arraybuffer",
                timeout: 30000,
                maxContentLength: 20 * 1024 * 1024
            });

            const returned = await sharp(Buffer.from(response.data), {
                limitInputPixels: 40000000
            }).metadata();

            const sentRatio = info.width / info.height;
            const returnedRatio = returned.width / returned.height;

            const ratioMatches =
                Number.isFinite(returnedRatio) &&
                Math.abs(returnedRatio / sentRatio - 1) < 0.02;

            return reply(
"✅ *Profile photo updated*\n\n" +
"📤 Sent: " + info.width + " × " + info.height + "\n" +
"📥 Read back: " + returned.width + " × " + returned.height + "\n\n" +
(ratioMatches
    ? "✅ Aspect ratio matches."
    : "⚠️ Aspect ratio differs — WhatsApp may have processed/cached the image.")
            );
        } catch (error) {
            console.log("[SETFULLPFP]", error.message || error);

            return reply(
                pfpUploaded
                    ? "⚠️ Upload accepted, but verification failed:\n" + error.message
                    : "❌ Profile-photo update failed:\n" + error.message
            );
        }
    }
};
