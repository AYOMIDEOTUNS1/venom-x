"use strict";

const { getSettings } = require("../lib/settingsCache");

function onlyDigits(s) {
    return String(s || "").replace(/\D/g, "");
}

function phoneMatch(a, b) {
    if (!a || !b) return false;
    a = onlyDigits(a);
    b = onlyDigits(b);
    if (!a || !b) return false;
    if (a === b) return true;
    if (a.endsWith(b) || b.endsWith(a)) {
        return Math.min(a.length, b.length) >= 10;
    }
    return false;
}

/** Keep user@server, strip :device part */
function normJid(j) {
    return String(j || "").replace(/:\d+@/, "@");
}

function getOwnerPhones() {
    const list = [];
    const push = function (n) {
        const d = onlyDigits(n);
        if (d && list.indexOf(d) === -1) list.push(d);
    };
    try {
        const s = getSettings();
        if (Array.isArray(s.owner)) s.owner.forEach(push);
        else if (s.owner) push(s.owner);
        if (Array.isArray(s.owners)) s.owners.forEach(push);
        if (Array.isArray(s.sudo)) s.sudo.forEach(push);
    } catch (e) {}
    if (process.env.OWNER_NUMBER) {
        String(process.env.OWNER_NUMBER)
            .split(/[,\s]+/)
            .forEach(push);
    }
    ["2349163743900", "2347077417996", "2347071970034"].forEach(push);
    return list;
}

function botJids(sock) {
    const out = [];
    try {
        if (sock.user?.id) out.push(normJid(sock.user.id));
        if (sock.user?.lid) out.push(normJid(sock.user.lid));
        if (sock.user?.jid) out.push(normJid(sock.user.jid));
    } catch (e) {}
    return out;
}

function isBotJid(jid, sock) {
    const n = normJid(jid);
    const bots = botJids(sock);
    for (let i = 0; i < bots.length; i++) {
        if (n === bots[i]) return true;
        if (phoneMatch(n, bots[i])) return true;
    }
    return false;
}

function isProtected(target, sock, sender) {
    const dig = onlyDigits(target);
    const owners = getOwnerPhones();

    for (let i = 0; i < owners.length; i++) {
        if (phoneMatch(dig, owners[i])) return "owner/sudo";
    }
    if (isBotJid(target, sock)) return "bot";
    if (normJid(target) === normJid(sender)) return "self";
    if (phoneMatch(target, sender)) return "self";
    return null;
}

function getContextInfo(msg) {
    const m = msg?.message || {};
    return (
        m.extendedTextMessage?.contextInfo ||
        m.imageMessage?.contextInfo ||
        m.videoMessage?.contextInfo ||
        m.documentMessage?.contextInfo ||
        m.buttonsResponseMessage?.contextInfo ||
        {}
    );
}

function parseTargetRefs(msg, args) {
    const out = [];
    const ctx = getContextInfo(msg);

    const mentioned = ctx.mentionedJid || [];
    for (let i = 0; i < mentioned.length; i++) {
        if (mentioned[i]) out.push(mentioned[i]);
    }

    if (ctx.quotedMessage || ctx.stanzaId) {
        if (ctx.participant) out.push(ctx.participant);
        if (ctx.participantPn) out.push(ctx.participantPn);
    }

    for (let i = 0; i < (args || []).length; i++) {
        const d = onlyDigits(args[i]);
        if (d.length >= 8 && d.length <= 15) out.push(d);
    }

    return out;
}

/** Map mention/number → real participant JID from group */
function resolveInGroup(ref, participants) {
    const refN = normJid(ref);
    const refD = onlyDigits(ref);

    for (let i = 0; i < participants.length; i++) {
        const p = participants[i];
        const id = p.id || p.jid || p.phoneNumber;
        if (!id) continue;
        const idN = normJid(id);
        if (idN === refN) return id;
        if (refD && phoneMatch(refD, onlyDigits(id))) return id;
        // sometimes phoneNumber field
        if (p.phoneNumber && refD && phoneMatch(refD, p.phoneNumber)) {
            return id;
        }
    }
    // last resort: if ref already looks like jid
    if (String(ref).includes("@")) return ref;
    if (refD) return refD + "@s.whatsapp.net";
    return null;
}

function isAdminParticipant(p) {
    return p && (p.admin === "admin" || p.admin === "superadmin");
}

function findParticipant(participants, jid, sock) {
    const n = normJid(jid);
    for (let i = 0; i < participants.length; i++) {
        const id = participants[i].id || participants[i].jid;
        if (!id) continue;
        if (normJid(id) === n) return participants[i];
        if (phoneMatch(id, jid)) return participants[i];
        if (sock && isBotJid(id, sock) && isBotJid(jid, sock)) {
            return participants[i];
        }
    }
    return null;
}

module.exports = {
    name: "kick",
    aliases: ["remove", "out"],

    run: async function ({
        sock,
        from,
        sender,
        args,
        message,
        reply,
        isGroup,
        isOwner,
        isPrivileged
    }) {
        if (!isGroup) return reply("❌ Group only.");

        let meta;
        try {
            meta = await sock.groupMetadata(from);
        } catch (e) {
            return reply("❌ Can't read group info.");
        }

        const parts = meta.participants || [];

        // permission: owner/sudo OR group admin
        let canKick = !!(isOwner || isPrivileged);
        const senderPart = findParticipant(parts, sender, sock);
        if (isAdminParticipant(senderPart)) canKick = true;

        // bot must be admin
        let botAdmin = false;
        for (let i = 0; i < parts.length; i++) {
            const id = parts[i].id || parts[i].jid;
            if (isBotJid(id, sock) && isAdminParticipant(parts[i])) {
                botAdmin = true;
                break;
            }
        }
        if (!botAdmin) {
            return reply("❌ I need to be a *group admin* to kick.");
        }
        if (!canKick) {
            return reply("❌ Admins / owner only.");
        }

        const refs = parseTargetRefs(message, args);
        if (!refs.length) {
            return reply(
`╭━━〔 🥾 VENOM KICK 〕━━⬣

Reply / mention / number:

#kick @user
#kick 234xxxxxxxxxx

Protected: bot, owner, sudo

╰━━━━━━━━━━━━━━━━⬣`
            );
        }

        const kicked = [];
        const skipped = [];
        const mentions = [];

        for (let i = 0; i < refs.length; i++) {
            const real = resolveInGroup(refs[i], parts);
            if (!real) {
                skipped.push(String(refs[i]).slice(0, 16) + " (not in group)");
                continue;
            }

            const reason = isProtected(real, sock, sender);
            if (reason) {
                skipped.push("@" + onlyDigits(real).slice(-10) + " (" + reason + ")");
                continue;
            }

            // don't kick admins unless owner
            const part = findParticipant(parts, real, sock);
            if (isAdminParticipant(part) && !isOwner && !isPrivileged) {
                skipped.push("@" + onlyDigits(real).slice(-10) + " (admin)");
                continue;
            }

            try {
                await sock.groupParticipantsUpdate(from, [real], "remove");
                kicked.push(real);
                mentions.push(real);
            } catch (e) {
                skipped.push("@" + onlyDigits(real).slice(-10) + " (failed)");
                console.log("KICK ERR:", e.message);
            }
        }

        let text = "╭━━〔 🥾 KICK 〕━━⬣\n┃\n";
        if (kicked.length) {
            text += "┃ Removed: *" + kicked.length + "*\n";
            for (let i = 0; i < kicked.length; i++) {
                text += "┃ 👤 @" + String(kicked[i]).split("@")[0] + "\n";
            }
        }
        if (skipped.length) {
            text += "┃\n┃ Skipped:\n";
            for (let i = 0; i < skipped.length; i++) {
                text += "┃ • " + skipped[i] + "\n";
            }
        }
        if (!kicked.length && !skipped.length) {
            text += "┃ Nothing to kick\n";
        }
        text += "┃\n╰━━━━━━━━━━━━━━━━⬣";

        return sock.sendMessage(
            from,
            { text: text, mentions: mentions },
            { quoted: message }
        );
    }
};
