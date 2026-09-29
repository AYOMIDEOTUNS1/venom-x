const banlist = require("../lib/banlist");

function targetFrom(message, args) {
    const ctx =
        message.message &&
        message.message.extendedTextMessage &&
        message.message.extendedTextMessage.contextInfo;

    if (ctx && ctx.mentionedJid && ctx.mentionedJid[0]) {
        return ctx.mentionedJid[0];
    }
    if (ctx && ctx.participant && ctx.quotedMessage) {
        return ctx.participant;
    }
    if (args[0]) {
        const n = String(args[0]).replace(/[^0-9]/g, "");
        if (n) return n + "@s.whatsapp.net";
    }
    return null;
}

module.exports = {
    name: "ban",
    aliases: ["banuser"],

    run: async function ({ reply, message, args, isOwner, isPrivileged, sender }) {
        if (!(isOwner || isPrivileged)) return reply("👑 Owner / Sudo only.");

        const target = targetFrom(message, args);
        if (!target) {
            return reply("Usage:\n#ban @user [reason]\nOr reply to user message: #ban spam");
        }

        const reason = args.slice(1).join(" ") || args[0] && !args[0].replace(/[^0-9]/g, "") ? args.join(" ") : "No reason";
        const cleanReason = (args.join(" ").replace(/@\d+/g, "").trim()) || "No reason";

        banlist.ban(target, cleanReason, sender);
        return reply("🚫 Banned: *" + banlist.norm(target) + "*\nReason: " + cleanReason);
    }
};
