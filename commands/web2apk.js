const { downloadMediaMessage } = require("@whiskeysockets/baileys");

module.exports = {
    name: "web2apk",
    aliases: ["apkweb", "toapk", "site2apk"],

    run: async function ({ sock, from, args, reply, message }) {
        const quoted =
            message.message &&
            message.message.extendedTextMessage &&
            message.message.extendedTextMessage.contextInfo &&
            message.message.extendedTextMessage.contextInfo.quotedMessage;

        if (!quoted || !quoted.imageMessage) {
            return reply(
"╭━━〔 📱 VENOM X WEB2APK 〕━━⬣\n\n" +
"Reply to an **image** (app icon) and type:\n\n" +
"#web2apk <website-url> <app-name>\n\n" +
"Example:\n" +
"#web2apk https://fast.com MyFast\n\n" +
"Notes:\n" +
"• Icon = replied image\n" +
"• Real APK build needs a builder API/server\n" +
"• Free Render cannot compile Android SDK APKs\n\n" +
"╰━━━━━━━━━━━━━━━━⬣"
            );
        }

        const site = args[0];
        const appName = args.slice(1).join(" ").trim();

        if (!site || !appName) {
            return reply("❌ Usage:\n#web2apk <url> <app-name>\n(while replying to icon image)");
        }

        let url = site;
        if (!/^https?:\/\//i.test(url)) url = "https://" + url;

        try {
            new URL(url);
        } catch (e) {
            return reply("❌ Invalid website URL.");
        }

        await reply("🔥 Building APK request...\nThis may take a moment.");

        try {
            const icon = await downloadMediaMessage(
                { message: quoted },
                "buffer",
                {}
            );

            const pkg =
                "com." +
                appName.toLowerCase().replace(/[^a-z0-9]+/g, "") +
                ".web2apk";

            // Placeholder: no local Android SDK on Render/Termux
            return reply(
"╭━━〔 📱 WEB2APK 〕━━⬣\n\n" +
"✅ Request received\n" +
"🖼️ Icon: " + icon.length + " bytes\n" +
"🔗 URL: " + url + "\n" +
"📛 Name: " + appName + "\n" +
"📦 Package: " + pkg + "\n\n" +
"❌ APK compiler not connected yet.\n\n" +
"To finish like other bots you need:\n" +
"• a web2apk builder API, or\n" +
"• a VPS with Android SDK + Cordova/TWA\n\n" +
"Command UI is ready — builder backend next.\n\n" +
"╰━━━━━━━━━━━━━━━━⬣"
            );
        } catch (err) {
            return reply("❌ WEB2APK error:\n" + err.message);
        }
    }
};
