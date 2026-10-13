"use strict";

const fs = require("fs");
const path = require("path");

const ANTILINK_DB = path.join(__dirname, "..", "database", "antilink.json");
const ANTISTATUS_DB = path.join(__dirname, "..", "database", "antistatustag.json");
const ANTICHANNEL_DB = path.join(__dirname, "..", "database", "antichannelmessage.json");
const WARN_DB = path.join(__dirname, "..", "database", "warnings.json");
const MAX = 3;

// Any URL / common short links
const ANY_LINK_RE =
    /(?:https?:\/\/|www\.)[^\s<>"']+|(?:chat\.whatsapp\.com|wa\.me|t\.me|telegram\.me|bit\.ly|tinyurl\.com|goo\.gl|youtu\.be|youtube\.com|instagram\.com|fb\.me|facebook\.com|tiktok\.com|vm\.tiktok\.com|twitter\.com|x\.com|discord\.gg|discord\.com)\/[^\s<>"']+/i;

// WhatsApp Channel links
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
    const db = load(file);
    return !!db[groupId];
}

function norm(id) {
    if (!id) return "";
    let s = String(id);
    if (s.includes(":")) s = s.split(":")[0];
    return s.replace(/@.*/, "");
}

function bodyOf(msg) {
    const m = msg.message || {};
    return (
        m.conversation ||
        m.extendedTextMessage?.text ||
        m.imageMessage?.caption ||
        m.videoMessage?.caption ||
        m.documentMessage?.caption ||
        ""
    );
}

function ctxOf(msg) {
    const m = msg.message || {};
    return (
        m.extendedTextMessage?.contextInfo ||
        m.imageMessage?.contextInfo ||
        m.videoMessage?.contextInfo ||
        m.audioMessage?.contextInfo ||
        m.documentMessage?.contextInfo ||
        m.stickerMessage?.contextInfo ||
        {}
    );
}

function isStatusTag(msg) {
    const ctx = ctxOf(msg);
    if (Array.isArray(ctx.statusAttributions) && ctx.statusAttributions.length) return true;
    if (ctx.isGroupStatus) return true;
    if (ctx.statusSourceType) return true;
    if (msg.message?.groupStatusMentionMessage) return true;
    return false;
}

function isChannelMsg(msg) {
    const ctx = ctxOf(msg);
    if (ctx.forwardedNewsletterMessageInfo) return true;
    if (ctx.newsletterJid) return true;
    if (msg.message?.newsletterAdminInviteMessage) return true;
    if (msg.message?.newsletterSubscriberInviteMessage) return true;

    // channel link in text
    const text = bodyOf(msg);
    if (text && CHANNEL_LINK_RE.test(text)) return true;

    return false;
}

async function isGroupAdmin(sock, groupId, userJid) {
    try {
        const meta = await sock.groupMetadata(groupId);
        const list = meta.participants || [];
        const n = norm(userJid);
        for (let i = 0; i < list.length; i++) {
            const p = list[i];
            const id = p.id || p.jid || p.phoneNumber || "";
            if (norm(id) === n || id === userJid) {
                return p.admin === "admin" || p.admin === "superadmin";
            }
        }
    } catch (e) {}
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
    const prev = Number(warns[from][key]) || 0;
    const count = prev + 1;
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

        const text =
            "╭━━〔 🚫 VENOM GUARD 〕━━⬣\n" +
            "┃\n" +
            "┃ 👤 " + mention + "\n" +
            "┃ 📝 " + reason + "\n" +
            "┃ ⚠️ Warning: " + MAX + "/" + MAX + "\n" +
            "┃ 🥾 Removed from group\n" +
            "┃\n" +
            "╰━━━━━━━━━━━━━━━━⬣";

        await sock
            .sendMessage(from, { text: text, mentions: [sender] })
            .catch(function () {});
        return;
    }

    const text =
        "╭━━〔 🛡️ VENOM GUARD 〕━━⬣\n" +
        "┃\n" +
        "┃ 👤 " + mention + "\n" +
        "┃ 📝 " + reason + "\n" +
        "┃ ⚠️ Warning: " + count + "/" + MAX + "\n" +
        "┃ 🚨 Left: " + left + "\n" +
        "┃\n" +
        "╰━━━━━━━━━━━━━━━━⬣";

    await sock
        .sendMessage(from, { text: text, mentions: [sender] })
        .catch(function () {});
}

async function runAntiGuards(sock, msg, from, sender) {
    if (!from || !from.endsWith("@g.us")) return false;
    if (!msg || !msg.message) return false;
    if (!sender) return false;

    try {
        if (await isGroupAdmin(sock, from, sender)) return false;
    } catch (e) {}

    // 1) antilink — ANY link
    if (isOn(ANTILINK_DB, from)) {
        const text = bodyOf(msg);
        if (text && ANY_LINK_RE.test(text)) {
            // if antichannel is on and this is only a channel link, let antichannel handle reason
            // still fine to treat as link
            await del(sock, from, msg);
            await warnAndMaybeKick(sock, from, sender, "Link not allowed");
            return true;
        }
    }

    // 2) antistatustag
    if (isOn(ANTISTATUS_DB, from) && isStatusTag(msg)) {
        await del(sock, from, msg);
        await warnAndMaybeKick(sock, from, sender, "Status tag / story mention");
        return true;
    }

    // 3) antichannel — forwards + channel links
    if (isOn(ANTICHANNEL_DB, from) && isChannelMsg(msg)) {
        await del(sock, from, msg);
        await warnAndMaybeKick(sock, from, sender, "Channel message / channel link");
        return true;
    }

    return false;
}

module.exports = { runAntiGuards };
