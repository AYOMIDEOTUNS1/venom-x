const fs = require("fs");
const path = require("path");

const SETTINGS_FILE = path.join(
    __dirname,
    "..",
    "settings.json"
);

function getSettings() {
    try {
        return JSON.parse(
            fs.readFileSync(
                SETTINGS_FILE,
                "utf8"
            )
        );
    } catch {
        return {};
    }
}

function saveSettings(settings) {
    fs.writeFileSync(
        SETTINGS_FILE,
        JSON.stringify(settings, null, 2)
    );
}

module.exports = {
    aliases: ["wel", "greet"],

    run: async ({ args, reply }) => {
        const settings = getSettings();

        const option =
            String(args?.[0] || "")
                .toLowerCase();

        if (
            option !== "on" &&
            option !== "off"
        ) {
            return reply(
                `╭━━〔 👋 WELCOME 〕━━⬣

┃ Current : ${
    settings.welcome === true
        ? "ON ✅"
        : "OFF ❌"
}

┃ Usage:
┃ .welcome on
┃ .welcome off

╰━━━━━━━━━━━━━━━━⬣`
            );
        }

        settings.welcome =
            option === "on";

        saveSettings(settings);

        return reply(
            settings.welcome
                ? "👋 Welcome messages are now ON ✅"
                : "👋 Welcome messages are now OFF ❌"
        );
    }
};
