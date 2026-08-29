const fs = require("fs");
const path = require("path");

const dbFile = path.join(
    __dirname,
    "..",
    "database",
    "antilink.json"
);

function load() {
    const dir = path.dirname(dbFile);

    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    if (!fs.existsSync(dbFile)) {
        fs.writeFileSync(dbFile, "{}");
    }

    try {
        const raw = fs.readFileSync(dbFile, "utf8");

        return raw.trim()
            ? JSON.parse(raw)
            : {};
    } catch {
        return {};
    }
}

function save(db) {
    fs.writeFileSync(
        dbFile,
        JSON.stringify(db, null, 2)
    );
}

module.exports = {
    name: "antilink",

    aliases: ["antilink"],

    run: async ({ from, reply, args }) => {

        if (!from.endsWith("@g.us")) {
            return reply(
                "❌ This command can only be used in groups."
            );
        }

        const db = load();

        const mode =
            String(args?.[0] || "")
                .toLowerCase();

        if (mode === "on") {

            db[from] = true;

            save(db);

            return reply(
`╭━━〔 🛡️ VENOM X ANTILINK 〕━━⬣
┃
┃ ✅ Antilink enabled
┃
┃ 🔗 WhatsApp invite links
┃ will be deleted.
┃
┃ ⚠️ Warning System
┃ 1/3 → Warning
┃ 2/3 → Warning
┃ 3/3 → Kick
┃
╰━━━━━━━━━━━━━━━━⬣`
            );
        }

        if (mode === "off") {

            db[from] = false;

            save(db);

            return reply(
`╭━━〔 🛡️ VENOM X ANTILINK 〕━━⬣
┃
┃ ❌ Antilink disabled
┃
┃ 🔗 Links are now allowed.
╰━━━━━━━━━━━━━━━━⬣`
            );
        }

        return reply(
`╭━━〔 🛡️ VENOM X ANTILINK 〕━━⬣
┃
┃ Usage:
┃ .antilink on
┃ .antilink off
┃
┃ ⚠️ 3 warnings = kick
╰━━━━━━━━━━━━━━━━⬣`
        );
    }
};
