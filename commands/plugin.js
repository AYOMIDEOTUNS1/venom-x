"use strict";

const fs = require("fs");
const path = require("path");

const CMD_DIR = path.join(__dirname);

module.exports = {
    name: "plugin",
    aliases: ["getplugin", "exportplugin", "cmdfile"],

    run: async function ({ sock, from, args, reply, message, isOwner, isPrivileged }) {
        if (!isOwner && !isPrivileged) {
            return reply("❌ Owner / sudo only.");
        }

        const name = String(args[0] || "")
            .toLowerCase()
            .replace(/\.js$/i, "")
            .replace(/[^a-z0-9_-]/g, "");

        if (!name || name === "list" || name === "ls") {
            const files = fs
                .readdirSync(CMD_DIR)
                .filter(function (f) {
                    return f.endsWith(".js");
                })
                .sort();

            let text =
                "╭━━〔 📦 VENOM PLUGINS 〕━━⬣\n┃\n" +
                "┃ Total: *" +
                files.length +
                "*\n┃\n";
            for (let i = 0; i < files.length; i++) {
                text += "┃ • " + files[i].replace(/\.js$/, "") + "\n";
            }
            text +=
                "┃\n┃ Export one:\n┃ #plugin play\n┃ #plugin status2\n" +
                "╰━━━━━━━━━━━━━━━━⬣";
            return reply(text);
        }

        const filePath = path.join(CMD_DIR, name + ".js");
        if (!fs.existsSync(filePath)) {
            return reply(
                "❌ Plugin not found: *" +
                    name +
                    "*\nUse `#plugin list`"
            );
        }

        const code = fs.readFileSync(filePath);
        await sock.sendMessage(
            from,
            {
                document: code,
                mimetype: "application/javascript",
                fileName: name + ".js",
                caption:
                    "✅ *Plugin exported*\n📦 `" +
                    name +
                    ".js`\n⚡ VENOM X"
            },
            { quoted: message }
        );
    }
};
