function digits(v) {
    return String(v || "").replace(/[^0-9]/g, "");
}

function collectIds(ctx) {
    const msg = ctx && ctx.message;
    const key = msg && msg.key ? msg.key : {};
    const list = [
        ctx && ctx.sender,
        ctx && ctx.senderPn,
        ctx && ctx.participantPn,
        key.participant,
        key.participantPn,
        key.senderPn,
        key.remoteJid,
        key.participantAlt,
        key.remoteJidAlt
    ];
    const out = [];
    for (let i = 0; i < list.length; i++) {
        const d = digits(list[i]);
        if (d && out.indexOf(d) === -1) out.push(d);
    }
    return out;
}

function isOwnerContext(ctx) {
    if (!ctx) return false;
    if (ctx.isOwner === true) return true;

    const msg = ctx.message;
    if (msg && msg.key && msg.key.fromMe) return true;

    const settings = ctx.settings || {};
    const owners = [];
    const n = digits(settings.ownerNumber);
    const l = digits(settings.ownerLid);
    if (n) owners.push(n);
    if (l) owners.push(l);

    // also allow bot's own jid as owner
    try {
        if (ctx.sock && ctx.sock.user) {
            const bot = digits(ctx.sock.user.id || ctx.sock.user.lid);
            if (bot) owners.push(bot);
        }
    } catch (e) {}

    const ids = collectIds(ctx);
    for (let i = 0; i < ids.length; i++) {
        for (let j = 0; j < owners.length; j++) {
            if (ids[i] === owners[j]) return true;
            // match last 10–12 digits (country code differences)
            if (ids[i].length >= 10 && owners[j].length >= 10) {
                if (ids[i].slice(-10) === owners[j].slice(-10)) return true;
            }
        }
    }
    return false;
}

module.exports = { isOwnerContext, digits, collectIds };
