"use strict";

/**
 * VENOM X — Sticker / emoji react helper
 * Native sticker-reactions are not stable in Baileys yet.
 * This saves one sticker and replies with it (quoted) = practical sticker react.
 *
 * #setreactsticker  → reply to a sticker to save it
 * #reactsticker     → reply to a message to react with saved sticker
 * #reactsticker emoji 🔥 → emoji react on quoted message
 */

const fs = require("fs");
const path = require("path");
const { downloadContentFromMessage } = require("@whiskeysockets/baileys");
const { getSettings } = require("../lib/settingsCache");

const DATA_DIR = path.join(__dirname, "../data");
const STICKER_FILE = path.join(DATA_DIR, "react_sticker.webp");
const META_FILE = path.join(DATA_DIR, "react_sticker.json");

function px() {
    try {
        return getSettings().prefix || "#";
    } catch (e) {
        return "#";
    }
}

function ensureDir() {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function hasSavedSticker() {
    return fs.existsSync(STICKER_FILE) && fs.statSync(STICKER_FILE).size > 100;
}

function getQuoted(message) {
    return (
        message?.message?.extendedTextMessage?.contextInfo ||
        message?.message?.imageMessage?.contextInfo ||
        message?.message?.stickerMessage?.contextInfo ||
        message?.message?.videoMessage?.contextInfo ||
        null
    );
}

function unwrap(msg) {
    let cur = msg;
    for (let i = 0; i < 5 && cur; i++) {
        if (cur.stickerMessage) return { type: "sticker", node: cur.stickerMessage };
        if (cur.imageMessage) return { type: "image", node: cur.imageMessage };
        const wrap =
            cur.ephemeralMessage?.message ||
            cur.viewOnceMessage?.message ||
            cur.viewOnceMessageV2?.message ||
            cur.viewOnceMessageV2Extension?.message ||
            cur.documentWithCaptionMessage?.message;
        if (!wrap) break;
        cur = wrap;
    }
    return null;
}

async function downloadStickerBuffer(stickerNode) {
    const stream = await downloadContentFromMessage(stickerNode, "sticker");
    const chunks = [];
    for await (const c of stream) chunks.push(c);
    const buf = Buffer.concat(chunks);
    if (!buf.length) throw new Error("Empty sticker");
    return buf;
}

module.exports = {
    name: "reactsticker",
    aliases: ["rsticker", "sreact", "stickreact"],

    run: async function ({ sock, from, args, reply, message, commandName }) {
        const sub = String((args && args[0]) || "").toLowerCase();
        const ctx = getQuoted(message);
        const quotedMsg = ctx?.quotedMessage || null;
        const quotedKey = {
            remoteJid: from,
            id: ctx?.stanzaId,
            fromMe: ctx?.participant
                ? false
                : !!(message.key && message.key.fromMe),
            participant: ctx?.participant
        };

        // ── SET sticker ──────────────────────────────────────
        if (
            commandName === "setreactsticker" ||
            sub === "set" ||
            sub === "save"
        ) {
            if (!quotedMsg) {
                return reply(
`╭━━〔 🧷 SET REACT STICKER 〕━━⬣

Reply to a *sticker* with:
${px()}setreactsticker

or
${px()}reactsticker set

╰━━━━━━━━━━━━━━━━⬣`
                );
            }

            const media = unwrap(quotedMsg);
            if (!media || media.type !== "sticker") {
                return reply("❌ Reply to a *sticker* to save it.");
            }

            try {
                const buf = await downloadStickerBuffer(media.node);
                ensureDir();
                fs.writeFileSync(STICKER_FILE, buf);
                fs.writeFileSync(
                    META_FILE,
                    JSON.stringify(
                        { savedAt: Date.now(), size: buf.length },
                        null,
                        2
                    )
                );
                return reply(
`╭━━〔 ✅ REACT STICKER SAVED 〕━━⬣

Sticker locked in.
Use:
${px()}reactsticker
(reply to any message)

╰━━━━━━━━━━━━━━━━⬣`
                );
            } catch (e) {
                return reply("❌ Failed to save sticker:\n" + e.message);
            }
        }

        // ── STATUS ───────────────────────────────────────────
        if (sub === "status" || sub === "info") {
            return reply(
                hasSavedSticker()
                    ? "✅ React sticker is *saved*.\nReply to a message with " +
                          px() +
                          "reactsticker"
                    : "❌ No sticker saved yet.\n" +
                          px() +
                          "setreactsticker (reply to sticker)"
            );
        }

        // ── EMOJI REACT ──────────────────────────────────────
        if (sub === "emoji" || sub === "e") {
            const emoji = (args && args[1]) || "🔥";
            if (!ctx?.stanzaId) {
                return reply("❌ Reply to a message first.");
            }
            try {
                await sock.sendMessage(from, {
                    react: { text: emoji, key: quotedKey }
                });
                return reply("✅ Reacted with " + emoji);
            } catch (e) {
                return reply("❌ Emoji react failed:\n" + e.message);
            }
        }

        // ── STICKER REACT (quoted sticker reply) ─────────────
        if (!ctx?.stanzaId) {
            return reply(
`╭━━〔 🧷 VENOM REACT STICKER 〕━━⬣

1) Save a sticker:
   Reply to sticker → ${px()}setreactsticker

2) React to a message:
   Reply to message → ${px()}reactsticker

3) Emoji react:
   Reply → ${px()}reactsticker emoji 🔥

Status: ${hasSavedSticker() ? "✅ sticker saved" : "❌ no sticker yet"}

Note: WhatsApp native sticker-reactions
are not fully open in Baileys yet.
This sends your saved sticker *as a reply*.

╰━━━━━━━━━━━━━━━━⬣`
            );
        }

        if (!hasSavedSticker()) {
            return reply(
                "❌ No sticker saved.\nReply to a sticker with:\n" +
                    px() +
                    "setreactsticker"
            );
        }

        try {
            const buf = fs.readFileSync(STICKER_FILE);
            await sock.sendMessage(
                from,
                { sticker: buf },
                {
                    quoted: {
                        key: quotedKey,
                        message: quotedMsg
                    }
                }
            );
        } catch (e) {
            console.log("REACT STICKER ERROR:", e.message);
            return reply("❌ Sticker react failed:\n" + e.message);
        }
    }
};

// alias file name support for set command as separate name
module.exports.aliases.push("setreactsticker");
