"use strict";

const {
    proto,
    generateWAMessageFromContent
} = require("@whiskeysockets/baileys");
const {
    clonedMessageHasField,
    collectClonedMessageTypes,
    ensureCache
} = require("../lib/messageClone");

module.exports = {
    name: "getcode",
    aliases: ["getmsg", "exportmsg"],

    run: async function ({ sock, from, message, reply, isOwner, isPrivileged }) {
        if (!isOwner && !isPrivileged) {
            return reply("❌ Owner / sudo only.");
        }

        const context =
            message?.message?.extendedTextMessage?.contextInfo;
        if (!context?.stanzaId) {
            return reply("⚠️ Reply to a message with #getcode");
        }

        try {
            ensureCache();
            const cacheKey = from + ":" + context.stanzaId;
            let protobufBytes = global.completeMessageCache.get(cacheKey);
            let extractionSource = "completeMessageCache";

            if (!protobufBytes && context.quotedMessage) {
                const quotedProto = proto.Message.fromObject(
                    context.quotedMessage
                );
                protobufBytes = Buffer.from(
                    proto.Message.encode(quotedProto).finish()
                );
                extractionSource = "quotedMessage fallback";
            }

            if (!protobufBytes) {
                return reply(
                    "❌ Message not cached.\nSend it again, then immediately reply #getcode"
                );
            }

            const decodedMessage = proto.Message.decode(protobufBytes);

            if (clonedMessageHasField(decodedMessage, "verificationMetadata")) {
                return reply(
                    "❌ Won't export forged bot-verification signatures."
                );
            }

            const payloadObject = proto.Message.toObject(decodedMessage, {
                longs: String,
                enums: Number,
                bytes: String,
                defaults: false,
                arrays: true,
                objects: true,
                oneofs: true
            });

            const detectedTypes = [...collectClonedMessageTypes(decodedMessage)];
            const containsButtons = clonedMessageHasField(
                decodedMessage,
                "buttonsMessage"
            );
            const containsInteractive = clonedMessageHasField(
                decodedMessage,
                "interactiveMessage"
            );
            const containsCarousel = clonedMessageHasField(
                decodedMessage,
                "carouselMessage"
            );
            const containsList = clonedMessageHasField(
                decodedMessage,
                "listMessage"
            );

            const sourceCode = [
                "// EXTRACTED WHATSAPP MESSAGE",
                "// source: " + extractionSource,
                "// size: " + protobufBytes.length,
                "// types: " + (detectedTypes.join(", ") || "unknown"),
                "",
                "const payloadObject = " +
                    JSON.stringify(payloadObject, null, 2) +
                    ";",
                "",
                "// Use with #try (reply to this file) or paste into a command.",
                "// flags: buttons=" +
                    containsButtons +
                    " interactive=" +
                    containsInteractive +
                    " carousel=" +
                    containsCarousel +
                    " list=" +
                    containsList
            ].join("\n");

            // store for #try <id>
            if (!global.cloneStore) global.cloneStore = new Map();
            const shortId = String(context.stanzaId).slice(-12);
            global.cloneStore.set(shortId, {
                payloadObject: payloadObject,
                at: Date.now()
            });

            await sock.sendMessage(
                from,
                {
                    document: Buffer.from(sourceCode, "utf8"),
                    mimetype: "application/javascript",
                    fileName: "extracted-" + shortId + ".js",
                    caption:
                        "✅ *MESSAGE CODE EXPORTED*\n\n" +
                        "📦 " +
                        protobufBytes.length +
                        " bytes\n" +
                        "🔍 " +
                        extractionSource +
                        "\n" +
                        "🧩 " +
                        (detectedTypes.join(", ") || "unknown") +
                        "\n" +
                        "🆔 try id: `" +
                        shortId +
                        "`\n\n" +
                        "Reply this file with #try\nor #try " +
                        shortId
                },
                { quoted: message }
            );
        } catch (error) {
            console.error("[GETCODE]", error);
            return reply("❌ Getcode failed:\n" + (error.message || error));
        }
    }
};
