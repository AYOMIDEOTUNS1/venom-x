"use strict";

const fs = require("fs");
const path = require("path");

const SETTINGS = path.join(__dirname, "../settings.json");

function load() {
    try {
        return JSON.parse(fs.readFileSync(SETTINGS, "utf8"));
    } catch (e) {
        return {};
    }
}

function save(s) {
    fs.writeFileSync(SETTINGS, JSON.stringify(s, null, 2));
}

module.exports = {
    name: "public",
    aliases: ["openbot"],

    run: async function ({ reply, isOwner, isPrivileged }) {
        if (!isOwner && !isPrivileged) {
            return reply("❌ Owner only.");
        }
        const s = load();
        s.mode = "public";
        s.public = true;
        save(s);
        try {
            const cache = require("../lib/settingsCache");
            if (cache.invalidate) cache.invalidate();
            if (cache.reload) cache.reload();
        } catch (e) {}
        return reply(
`╭━━〔 🌍 PUBLIC MODE 〕━━⬣
┃
┃ Everyone can use the bot.
┃
╰━━━━━━━━━━━━━━━━⬣`
        );
    }
};
