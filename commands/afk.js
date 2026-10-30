"use strict";

const afk = require("../lib/afk");
const { getSettings } = require("../lib/settingsCache");

function px() {
    try {
        return getSettings().prefix || "#";
    } catch (e) {
        return "#";
    }
}

module.exports = {
    name: "afk",
    aliases: ["away"],

    run: async function ({ sender, args, reply }) {
        const prefix = px();
        const sub = String(args[0] || "").toLowerCase();

        if (sub === "off" || sub === "back" || sub === "end") {
            afk.clear(sender);
            return reply("✅ Welcome back. AFK removed.");
        }

        const reason = (args || []).join(" ").trim() || "AFK";
        afk.setManual(sender, reason);
        return reply(
`╭━━〔 💤 AFK ON 〕━━⬣
┃
┃ Reason: *${reason}*
┃
┃ Auto-AFK also triggers after *20 min*
┃ of silence if someone tags/replies you.
┃
┃ ${prefix}afk off — when you're back
╰━━━━━━━━━━━━━━━━⬣`
        );
    }
};
