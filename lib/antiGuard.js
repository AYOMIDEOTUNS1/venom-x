"use strict";

const fs = require("fs");
const path = require("path");
const { isGroupAdmin, phoneFromJid, onlyDigits } = require("./identity");

const ANTILINK_DB = path.join(__dirname, "..", "database", "antilink.json");
const ANTISTATUS_DB = path.join(__dirname, "..", "database", "antistatustag.json");
const ANTICHANNEL_DB = path.join(__dirname, "..", "database", "antichannelmessage.json");
const WARN_DB = path.join(__dirname, "..", "database", "warnings.json");
const MAX = 3;

const ANY_LINK_RE =
    /(?:https?:\/\/|www\.)[^\s<>"']+|(?:chat\.whatsapp\.com|wa\.me|t\.me|telegram\.me|bit\.ly|tinyurl\.com|goo\.gl|youtu\.be|youtube\.com|instagram\.com|fb\.me|facebook\.com|tiktok\.com|vm\.tiktok\.com|twitter\.com|x\.com|discord\.gg|discord\.com)\/[^\s<>"']+/i;

const CHANNEL_LINK_RE =
    /(?:https?:\/\/)?(?:www\.)?whatsapp\.com\/channel\/[A-Za-z0-9_-]+/i;

function load(file) {
    try {
        if (!fs.existsSync(file)) return {};
        const raw = fs.readFileSync(file, "utf8");
        if (!raw.trim()) return {};
        return JSON.parse(raw);
    } catch {
        return {};
    }
}

function save(file, data) {
    try {
        const dir = path.dirname(file);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(file, JSON.stringify(data, null, 2));
    } catch (e) {
        console.log("antiGuard save:", e.message);
    }
}

function isOn(file, groupId) {
    return !!load(file)[groupId];
}

function norm(id) {
    return onlyDigits(phoneFromJid(id)) || String(id || "").split("@")[0];
}

function bodyOf(msg) {
    const m = msg.message || {};
    return (
        m.conversation ||
        m.extendedTextMessage?.text ||
        m.imageMessage?.caption ||
        m.videoMessage?.caption ||
        m.documentMessage?.caption ||
        m.templateMessage?.hydratedTemplate?.hydratedContentText ||
        ""
    );
}

function walkMessages(msg) {
    const out = [];
    let cur = msg && msg.message;
    for (let i = 0; i < 6 && cur; i++) {
        out.push(cur);
        cur =
            cur.ephemeralMessage?.message ||
            cur.viewOnceMessage?.message ||
            cur.viewOnceMessageV2?.message ||
            cur.viewOnceMessageV2Extension?.message ||
            cur.documentWithCaptionMessage?.message ||
            null;
    }
    return out;
}

function allContextInfos(msg) {
    const infos = [];
    const layers = walkMessages(msg);
    for (let i = 0; i < layers.length; i++) {
        const m = layers[i];
        const keys = Object.keys(m || {});
        for (let k = 0; k < keys.length; k++) {
            const part = m[keys[k]];
            if (part && typeof part === "object" && part.contextInfo) {
                infos.push(part.contextInfo);
            }
        }
    }
    return infos;
}

function isStatusTag(msg) {
    if (msg.message?.groupStatusMentionMessage) return true;
    const infos = allContextInfos(msg);
    for (let i = 0; i < infos.length; i++) {
        const ctx = infos[i];
        if (Array.isArray(ctx.statusAttributions) && ctx.statusAttributions.length) return true;
        if (ctx.isGroupStatus) return true;
        if (ctx.statusSourceType) return true;
    }
    return false;
}

function isChannelMsg(msg) {
    const m = msg.message || {};
    if (m.newsletterAdminInviteMessage) return true;
    if (m.newsletterSubscriberInviteMessage) return true;
    if (m.newsletterMetadata) return true;

    const text = bodyOf(msg);
    if (text && CHANNEL_LINK_RE.test(text)) return true;

    const infos = allContextInfos(msg);
    for (let i = 0; i < infos.length; i++) {
        const ctx = infos[i];
        if (ctx.forwardedNewsletterMessageInfo) return true;
        if (ctx.newsletterJid) return true;
        if (ctx.serverMessageId && ctx.newsletterJid) return true;
        // external ad reply from channel
        if (ctx.externalAdReply && ctx.forwardedNewsletterMessageInfo) return true;
        // some builds only set forwardingScore + newsletter
        if (
            ctx.forwardedNewsletterMessageInfo ||
            (typeof ctx.forwardingScore === "number" &&
                ctx.forwardingScore > 0 &&
                String(ctx.entryPointConversionSource || "")
                    .toLowerCase()
                    .includes("newsletter"))
        ) {
            return true;
        }
    }

    // nested message types used for channel share cards
    const layers = walkMessages(msg);
    for (let i = 0; i < layers.length; i++) {
        const layer = layers[i];
        if (layer.newsletterAdminInviteMessage) return true;
        if (layer.newsletterSubscriberInviteMessage) return true;
        if (layer.albumMessage) {
            // ignore albums
        }
    }

    return false;
}

async function del(sock, from, msg) {
    try {
        await sock.sendMessage(from, { delete: msg.key });
        return true;
    } catch (e) {
        console.log("antiGuard delete fail:", e.message);
        return false;
    }
}

async function warnAndMaybeKick(sock, from, sender, reason) {
    const warns = load(WARN_DB);
    if (!warns[from]) warns[from] = {};
    const key = norm(sender);
    const count = (Number(warns[from][key]) || 0) + 1;
    warns[from][key] = count;
    save(WARN_DB, warns);

    const left = MAX - count;
    const mention = "@" + key;

    if (count >= MAX) {
        try {
            await sock.groupParticipantsUpdate(from, [sender], "remove");
            warns[from][key] = 0;
            save(WARN_DB, warns);
        } catch (e) {
            console.log("antiGuard kick fail:", e.message);
        }
        await sock
            .sendMessage(from, {
                text:
                    "╭━━〔 🚫 VENOM GUARD 〕━━⬣\n" +
                    "┃\n" +
                    "┃ 👤 " +
                    mention +
                    "\n" +
                    "┃ 📝 " +
                    reason +
                    "\n" +
                    "┃ ⚠️ Warning: " +
                    MAX +
                    "/" +
                    MAX +
                    "\n" +
                    "┃ 🥾 Removed from group\n" +
                    "┃\n" +
                    "╰━━━━━━━━━━━━━━━━⬣",
                mentions: [sender]
            })
            .catch(function () {});
        return;
    }

    await sock
        .sendMessage(from, {
            text:
                "╭━━〔 🛡️ VENOM GUARD 〕━━⬣\n" +
                "┃\n" +
                "┃ 👤 " +
                mention +
                "\n" +
                "┃ 📝 " +
                reason +
                "\n" +
                "┃ ⚠️ Warning: " +
                count +
                "/" +
                MAX +
                "\n" +
                "┃ 🚨 Left: " +
                left +
                "\n" +
                "┃\n" +
                "╰━━━━━━━━━━━━━━━━⬣",
            mentions: [sender]
        })
        .catch(function () {});
}

async function runAntiGuards(sock, msg, from, sender, opts) {
    opts = opts || {};
    if (!from || !from.endsWith("@g.us")) return false;
    if (!msg || !msg.message) return false;
    if (!sender) return false;

    // owner / sudo never punished
    if (opts.isPrivileged) return false;

    try {
        if (await isGroupAdmin(sock, from, sender, opts.phone)) return false;
    } catch (e) {}

    // Channel first (so reason is correct even if link regex also matches)
    if (isOn(ANTICHANNEL_DB, from) && isChannelMsg(msg)) {
        await del(sock, from, msg);
        await warnAndMaybeKick(sock, from, sender, "Channel message / channel link");
        return true;
    }

    if (isOn(ANTILINK_DB, from)) {
        const text = bodyOf(msg);
        if (text && ANY_LINK_RE.test(text)) {
            await del(sock, from, msg);
            await warnAndMaybeKick(sock, from, sender, "Link not allowed");
            return true;
        }
    }

    if (isOn(ANTISTATUS_DB, from) && isStatusTag(msg)) {
        await del(sock, from, msg);
        await warnAndMaybeKick(sock, from, sender, "Status tag / story mention");
        return true;
    }

    return false;
}

module.exports = { runAntiGuards };
