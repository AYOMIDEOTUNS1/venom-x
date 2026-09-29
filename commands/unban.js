const banlist = require("../lib/banlist");

function targetFrom(message, args) {
    const ctx =
        message.message &&
        message.message.extendedTextMessage &&
        message.message.extendedTextMessage.contextInfo;

    if (ctx && ctx.mentionedJid && ctx.mentionedJid[0]) return ctx.mentionedJid[0];
    if (ctx && ctx.participant && ctx.quotedMessage) return ctx.participant;
    if (args[0]) {
        const n = String(args[0]).replace(/[^0-9]/g, "");
        if (n) return n + "@s.whatsapp.net";
    }
    return null;
}

module.exports = {
    name: "unban",
    aliases: ["unbanuser"],

    run: async function ({ reply, message, args, isOwner, isPrivileged }) {
        if (!(isOwner || isPrivileged)) return reply("👑 Owner / Sudo only.");

        const target = targetFrom(message, args);
        if (!target) return reply("Usage:\n#unban @user\nOr #unban 234xxxxxxxx");

        const ok = banlist.unban(target);
        if (!ok) return reply("User is not banned.");
        return reply("✅ Unbanned: *" + banlist.norm(target) + "*");
    }
};
