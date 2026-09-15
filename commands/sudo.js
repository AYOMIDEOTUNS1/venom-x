const fs = require("fs");
const path = require("path");
const { getSettings } = require("../lib/settingsCache");

const SUDO_PATH = path.join(__dirname, "../data/sudo.json");

function loadSudo() {
    try {
        if (!fs.existsSync(SUDO_PATH)) {
            const dir = path.dirname(SUDO_PATH);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(SUDO_PATH, "[]");
            return [];
        }
        const raw = JSON.parse(fs.readFileSync(SUDO_PATH, "utf8") || "[]");
        return Array.isArray(raw) ? raw.map(cleanNumber).filter(Boolean) : [];
    } catch (e) {
        return [];
    }
}

function saveSudo(list) {
    try {
        const dir = path.dirname(SUDO_PATH);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(SUDO_PATH, JSON.stringify(list, null, 2));
    } catch (e) {
        console.log("[SUDO] Save error:", e.message);
    }
}

function cleanNumber(num) {
    return String(num || "").replace(/\D/g, "");
}

function prefix() {
    try {
        return getSettings().prefix || "#";
    } catch (e) {
        return "#";
    }
}

function isSudoNumber(num) {
    const n = cleanNumber(num);
    if (!n) return false;
    return loadSudo().indexOf(n) !== -1;
}

function resolveTarget(args, message) {
    let target = args[1];

    const ctx =
        message &&
        message.message &&
        message.message.extendedTextMessage &&
        message.message.extendedTextMessage.contextInfo;

    if (!target && ctx && ctx.participant) {
        target = ctx.participant;
    }
    if (!target && ctx && ctx.mentionedJid && ctx.mentionedJid[0]) {
        target = ctx.mentionedJid[0];
    }
    // quoted participant
    if (!target && ctx && ctx.participant) {
        target = ctx.participant;
    }

    return target || null;
}

module.exports = {
    name: "sudo",
    aliases: ["addsudo", "delsudo", "listsudo"],
    category: "owner",

    // used by messages.js / ownerCheck
    isSudoNumber: isSudoNumber,
    loadSudo: loadSudo,

    run: async function ({ args, reply, isOwner, message }) {
        if (!isOwner) {
            return reply("🚫 Only the *bot owner* can manage sudo.");
        }

        const p = prefix();
        const action = String(args[0] || "").toLowerCase();
        let sudoList = loadSudo();

        if (!action || action === "help") {
            return reply(
`╭━━〔 👑 SUDO MANAGER 〕━━⬣

Add:
${p}sudo add @user
${p}sudo add 234xxxxxxxxxx

Remove:
${p}sudo del @user
${p}sudo del 234xxxxxxxxxx

List:
${p}sudo list

╰━━━━━━━━━━━━━━━━⬣`
            );
        }

        if (action === "list" || action === "ls") {
            if (!sudoList.length) {
                return reply("📭 No sudo users yet.");
            }

            let listText = "";
            for (let i = 0; i < sudoList.length; i++) {
                listText += "│  " + (i + 1) + ". wa.me/" + sudoList[i] + "\n";
            }

            return reply(
`╭━━〔 👑 SUDO LIST 〕━━⬣
│ Total: *${sudoList.length}*
│
${listText}╰━━━━━━━━━━━━━━━━⬣`
            );
        }

        if (action === "add") {
            const target = resolveTarget(args, message);
            if (!target) {
                return reply("❌ Tag a user or type a number.\n" + p + "sudo add @user");
            }

            const number = cleanNumber(target);
            if (number.length < 8) {
                return reply("❌ Invalid number.");
            }
            if (sudoList.indexOf(number) !== -1) {
                return reply("⚠️ " + number + " is already sudo.");
            }

            sudoList.push(number);
            saveSudo(sudoList);
            return reply("✅ Added *" + number + "* as sudo.");
        }

        if (["del", "delete", "remove", "rm"].indexOf(action) !== -1) {
            const target = resolveTarget(args, message);
            if (!target) {
                return reply("❌ Tag a user or type a number.\n" + p + "sudo del @user");
            }

            const number = cleanNumber(target);
            if (sudoList.indexOf(number) === -1) {
                return reply("⚠️ " + number + " is not sudo.");
            }

            sudoList = sudoList.filter(function (n) {
                return n !== number;
            });
            saveSudo(sudoList);
            return reply("✅ Removed *" + number + "* from sudo.");
        }

        return reply("❌ Use: " + p + "sudo add | del | list");
    }
};
