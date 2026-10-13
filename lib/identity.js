"use strict";

function onlyDigits(s) {
    return String(s || "").replace(/\D/g, "");
}

function stripJid(jid) {
    if (!jid) return "";
    return String(jid).split("@")[0].split(":")[0];
}

/** Best-effort phone digits from any jid / alt field */
function phoneFromJid(jid) {
    const raw = stripJid(jid);
    // pure lid (long numeric) still digits — keep; owner list match may fail on pure lid
    return onlyDigits(raw);
}

/**
 * Resolve sender identity for groups & DMs (Baileys 7 / LID safe)
 */
function resolveSender(msg, from) {
    const key = msg.key || {};
    const isGroup = String(from || "").endsWith("@g.us");

    // Prefer phone-bearing fields when present (Baileys 7)
    const participant =
        key.participantPn ||
        key.participantAlt ||
        msg.participantPn ||
        key.participant ||
        msg.participant ||
        null;

    const senderJid = isGroup
        ? participant || from
        : key.remoteJidAlt || key.remoteJidPn || from;

    const phone =
        phoneFromJid(key.participantPn) ||
        phoneFromJid(key.participantAlt) ||
        phoneFromJid(key.remoteJidPn) ||
        phoneFromJid(key.remoteJidAlt) ||
        phoneFromJid(participant) ||
        phoneFromJid(senderJid) ||
        phoneFromJid(from);

    return {
        senderJid: senderJid || from,
        phone: phone,
        isGroup: isGroup
    };
}

function ownerList(settings) {
    const list = [];
    const push = function (n) {
        const d = onlyDigits(n);
        if (d && list.indexOf(d) === -1) list.push(d);
    };

    if (settings) {
        if (Array.isArray(settings.owner)) settings.owner.forEach(push);
        else if (settings.owner) push(settings.owner);
        if (Array.isArray(settings.owners)) settings.owners.forEach(push);
        if (Array.isArray(settings.sudo)) settings.sudo.forEach(push);
    }

    if (process.env.OWNER_NUMBER) {
        String(process.env.OWNER_NUMBER)
            .split(/[,\s]+/)
            .forEach(push);
    }

    // Your known owner numbers
    push("2349163743900");
    push("2347077417996");
    push("2347071970034");

    return list;
}

function isOwnerPhone(phone, settings) {
    if (!phone) return false;
    const owners = ownerList(settings);
    // exact or suffix match (country code variants)
    for (let i = 0; i < owners.length; i++) {
        const o = owners[i];
        if (phone === o) return true;
        if (phone.endsWith(o) || o.endsWith(phone)) {
            if (Math.min(phone.length, o.length) >= 10) return true;
        }
    }
    return false;
}

function isSudoPhone(phone, settings) {
    if (!phone || !settings || !Array.isArray(settings.sudo)) return false;
    const p = onlyDigits(phone);
    for (let i = 0; i < settings.sudo.length; i++) {
        const s = onlyDigits(settings.sudo[i]);
        if (s && (p === s || p.endsWith(s) || s.endsWith(p))) return true;
    }
    return false;
}

async function isGroupAdmin(sock, groupId, userJid, userPhone) {
    try {
        const meta = await sock.groupMetadata(groupId);
        const list = meta.participants || [];
        const n = onlyDigits(userPhone || phoneFromJid(userJid));
        const bare = stripJid(userJid);

        for (let i = 0; i < list.length; i++) {
            const p = list[i];
            const id = p.id || p.jid || p.phoneNumber || "";
            const pn = phoneFromJid(p.phoneNumber || p.jid || id);
            const match =
                id === userJid ||
                stripJid(id) === bare ||
                (n && pn && (n === pn || n.endsWith(pn) || pn.endsWith(n)));

            if (match) {
                return p.admin === "admin" || p.admin === "superadmin" || p.admin === true;
            }
        }
    } catch (e) {}
    return false;
}

module.exports = {
    onlyDigits,
    stripJid,
    phoneFromJid,
    resolveSender,
    ownerList,
    isOwnerPhone,
    isSudoPhone,
    isGroupAdmin
};
