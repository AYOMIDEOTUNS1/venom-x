"use strict";

const fs = require("fs");
const path = require("path");

const ANTILINK_DB = path.join(__dirname, "..", "database", "antilink.json");
const ANTISTATUS_DB = path.join(__dirname, "..", "database", "antistatustag.json");
const ANTICHANNEL_DB = path.join(__dirname, "..", "database", "antichannelmessage.json");
const WARN_DB = path.join(__dirname, "..", "database", "warnings.json");
const MAX = 3;

const LINK_RE =
    /(?:https?:\/\/)?(?:www\.)?(?:chat\.whatsapp\.com|wa\.me)\/[A-Za-z0-9_-]+/i;

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
        m.buttonsResponseMessage?.selectedDisplayText ||
        m.listResponseMessage?.title ||
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
    warns[from][key] = (Number(warns[from][key]) || 0) + 1;
    const count = warns[from][key];
    save(WARN_DB, warns);

    const left = MAX - count;

    if (count >= MAX) {
        try {
            await sock.groupParticipantsUpdate(from, [sender], "remove");
            warns[from][key] = 0;
            save(WARN_DB, warns);
        } catch (e) {
            console.log("antiGuard kick fail:", e.message);
        }
        await sock.sendMessage(from, {
            text:
`╭━━〔 🚫 VENOM GUARD 〕━━⬣
┃
┃ 👤 @${key}
┃ 📝 ${reason}
┃ ⚠️ \( {MAX}/ \){MAX}
┃ 🥾 Removed
┃
╰━━━━━━━━━━━━━━━━⬣`,
            mentions: [sender]
        }).catch(function () {});
        return;
    }

    await sock.sendMessage(from, {
        text:
`╭━━〔 🛡️ VENOM GUARD 〕━━⬣
┃
┃ 👤 @${key}
┃ 📝 ${reason}
┃ ⚠️ Warning: \( {count}/ \){MAX}
┃ 🚨 Left: ${left}
┃
╰━━━━━━━━━━━━━━━━⬣`,
        mentions: [sender]
    }).catch(function () {});
}

/**
 * Call this from messages.js for every group message (not fromMe).
 * Returns true if message was handled (deleted) — skip further processing optional.
 */
async function runAntiGuards(sock, msg, from, sender) {
    if (!from || !from.endsWith("@g.us")) return false;
    if (!msg || !msg.message) return false;
    if (!sender) return false;

    // bot / admin exempt
    try {
        if (await isGroupAdmin(sock, from, sender)) return false;
    } catch (e) {}

    // 1) antilink
    if (isOn(ANTILINK_DB, from)) {
        const text = bodyOf(msg);
        if (text && LINK_RE.test(text)) {
            await del(sock, from, msg);
            await warnAndMaybeKick(sock, from, sender, "Group invite link");
            return true;
        }
    }

    // 2) antistatustag
    if (isOn(ANTISTATUS_DB, from) && isStatusTag(msg)) {
        await del(sock, from, msg);
        await warnAndMaybeKick(sock, from, sender, "Status tag / story mention");
        return true;
    }

    // 3) antichannel
    if (isOn(ANTICHANNEL_DB, from) && isChannelMsg(msg)) {
        await del(sock, from, msg);
        await warnAndMaybeKick(sock, from, sender, "Channel / newsletter forward");
        return true;
    }

    return false;
}

module.exports = {
    runAntiGuards,
    isOn,
    ANTILINK_DB,
    ANTISTATUS_DB,
    ANTICHANNEL_DB
};
