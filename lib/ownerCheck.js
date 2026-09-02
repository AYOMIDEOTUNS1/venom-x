function digits(v) {
    return String(v || "").replace(/[^0-9]/g, "");
}

function isOwnerContext(ctx) {
    if (!ctx) return false;
    if (ctx.isOwner === true) return true;

    const msg = ctx.message;
    if (msg && msg.key && msg.key.fromMe) return true;

    const settings = ctx.settings || {};
    const ownerNumber = digits(settings.ownerNumber);
    const ownerLid = digits(settings.ownerLid);

    const ids = [
        digits(ctx.sender),
        digits(ctx.senderPn),
        digits(ctx.participantPn),
        digits(msg && msg.key && msg.key.participant),
        digits(msg && msg.key && msg.key.remoteJid),
        digits(msg && msg.key && msg.key.senderPn),
        digits(msg && msg.key && msg.key.participantPn)
    ];

    for (let i = 0; i < ids.length; i++) {
        const id = ids[i];
        if (!id) continue;
        if (ownerNumber && id === ownerNumber) return true;
        if (ownerLid && id === ownerLid) return true;
    }
    return false;
}

module.exports = { isOwnerContext, digits };
