"use strict";

const {
    proto,
    generateWAMessageFromContent
} = require("@whiskeysockets/baileys");
const { downloadMediaMessage } = require("@whiskeysockets/baileys");
const { getCloneRelayNodes } = require("../lib/messageClone");

function extractPayloadFromJs(text) {
    const m = String(text || "").match(
        /const\s+payloadObject\s*=\s*(\{[\s\S]*\});/
    );
    if (!m) return null;
    try {
        // eslint-disable-next-line no-new-func
        return Function("return (" + m[1] + ")")();
    } catch (e) {
        try {
            return JSON.parse(m[1]);
        } catch (e2) {
            return null;
        }
    }
}

module.exports = {
    name: "try",
    aliases: ["trycode", "clonemsg"],

    run: async function ({ sock, from, args, message, reply, isOwner, isPrivileged }) {
        if (!isOwner && !isPrivileged) {
            return reply("❌ Owner / sudo only.");
        }

        try {
            let payloadObject = null;

            // #try <id>
            const idArg = String(args[0] || "").trim();
            if (idArg && global.cloneStore && global.cloneStore.has(idArg)) {
                payloadObject = global.cloneStore.get(idArg).payloadObject;
            }

            // reply to getcode document
            if (!payloadObject) {
                const q =
                    message?.message?.extendedTextMessage?.contextInfo
                        ?.quotedMessage;
                if (q?.documentMessage) {
                    const buf = await downloadMediaMessage(
                        { message: q },
                        "buffer",
                        {}
                    );
                    const text = buf.toString("utf8");
                    payloadObject = extractPayloadFromJs(text);
                }
            }

            if (!payloadObject) {
                return reply(
                    "⚠️ Reply to a #getcode JS file with #try\nor use #try <id>"
                );
            }

            const extractedPayload = proto.Message.fromObject(payloadObject);
            const additionalNodes = getCloneRelayNodes(extractedPayload, from);

            const extractedMessage = generateWAMessageFromContent(
                from,
                extractedPayload,
                { userJid: sock.user.id }
            );

            await sock.relayMessage(from, extractedMessage.message, {
                messageId: extractedMessage.key.id,
                additionalNodes: additionalNodes
            });

            return reply("✅ Cloned message sent.");
        } catch (err) {
            console.error("[TRY]", err);
            return reply("❌ Try failed:\n" + (err.message || err));
        }
    }
};
