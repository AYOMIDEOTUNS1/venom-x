"use strict";

const { getSettings } = require("../lib/settingsCache");

function onlyDigits(s) {
    return String(s || "").replace(/\D/g, "");
}

function phoneMatch(a, b) {
    if (!a || !b) return false;
    if (a === b) return true;
    if (a.endsWith(b) || b.endsWith(a)) {
        return Math.min(a.length, b.length) >= 10;
    }
    return false;
}

function normJid(j) {
    return String(j || "").split(":")[0];
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
        String(process.env.OWNER_NUMBER).split(/[,\s]+/).forEach(push);
    }
    ["2349163743900", "2347077417996", "2347071970034"].forEach(push);
    return list;
}

function isProtected(target, sock, sender) {
    const dig = onlyDigits(target);
    const owners = getOwnerPhones();

    // owners / sudo numbers
    for (let i = 0; i < owners.length; i++) {
        if (phoneMatch(dig, owners[i])) return "owner/sudo";
    }

    // bot itself
    try {
        const botId = sock.user && (sock.user.id || sock.user.lid);
        if (botId) {
            const botJ = normJid(botId);
            if (normJid(target) === botJ) return "bot";
            if (phoneMatch(dig, onlyDigits(botId))) return "bot";
        }
        if (sock.user && sock.user.jid) {
            if (normJid(target) === normJid(sock.user.jid)) return "bot";
        }
    } catch (e) {}

    // don't kick yourself via weird mention (optional soft block)
    if (normJid(target) === normJid(sender)) return "self";

    return null;
}

function parseTargets(msg, args) {
    const out = [];
    const ctx =
        msg?.message?.extendedTextMessage?.contextInfo ||
        msg?.message?.imageMessage?.contextInfo ||
        {};

    const mentioned = ctx.mentionedJid || [];
    for (let i = 0; i < mentioned.length; i++) {
        if (mentioned[i]) out.push(mentioned[i]);
    }

    // reply
    if (ctx.participant && out.indexOf(ctx.participant) === -1) {
        // only if this is a reply (quoted)
        if (ctx.quotedMessage || ctx.stanzaId) {
            out.push(ctx.participant);
        }
    }

    // numbers in args
    for (let i = 0; i < (args || []).length; i++) {
        const d = onlyDigits(args[i]);
        if (d.length >= 8 && d.length <= 15) {
            out.push(d + "@s.whatsapp.net");
        }
    }

    // unique
    const seen = {};
    const uniq = [];
    for (let i = 0; i < out.length; i++) {
        const j = normJid(out[i]);
        if (!j || seen[j]) continue;
        seen[j] = true;
        uniq.push(out[i]);
    }
    return uniq;
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
        if (!isGroup) {
            return reply("❌ Group only.");
        }

        // who may kick
        let canKick = !!(isOwner || isPrivileged);
        try {
            const meta = await sock.groupMetadata(from);
            const parts = meta.participants || [];
            for (let i = 0; i < parts.length; i++) {
                const id = parts[i].id || parts[i].jid;
                if (normJid(id) === normJid(sender) || phoneMatch(onlyDigits(id), onlyDigits(sender))) {
                    if (parts[i].admin === "admin" || parts[i].admin === "superadmin") {
                        canKick = true;
                    }
                }
            }
            // bot must be admin
            const botId = sock.user && sock.user.id;
            let botAdmin = false;
            for (let i = 0; i < parts.length; i++) {
                const id = parts[i].id || parts[i].jid;
                if (botId && (normJid(id) === normJid(botId) || phoneMatch(onlyDigits(id), onlyDigits(botId)))) {
                    if (parts[i].admin === "admin" || parts[i].admin === "superadmin") {
                        botAdmin = true;
                    }
                }
            }
            if (!botAdmin) {
                return reply("❌ I need to be a *group admin* to kick.");
            }
        } catch (e) {
            return reply("❌ Can't read group info.");
        }

        if (!canKick) {
            return reply("❌ Admins / owner only.");
        }

        const targets = parseTargets(message, args);
        if (!targets.length) {
            return reply(
`╭━━〔 🥾 VENOM KICK 〕━━⬣

Reply to someone or mention:

#kick @user
#kick 234xxxxxxxxxx

Protected (cannot kick):
• Bot number
• Owner / sudo

╰━━━━━━━━━━━━━━━━⬣`
            );
        }

        const kicked = [];
        const skipped = [];

        for (let i = 0; i < targets.length; i++) {
            const t = targets[i];
            const reason = isProtected(t, sock, sender);
            if (reason) {
                skipped.push("@" + onlyDigits(t).slice(-10) + " (" + reason + ")");
                continue;
            }
            try {
                await sock.groupParticipantsUpdate(from, [t], "remove");
                kicked.push(t);
            } catch (e) {
                skipped.push("@" + onlyDigits(t).slice(-10) + " (failed)");
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
            { text: text, mentions: kicked },
            { quoted: message }
        );
    }
};
