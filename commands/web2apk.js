const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { downloadContentFromMessage } = require("@whiskeysockets/baileys");

const BASE_URL = "https://webappcreator.amethystlab.org";
const HEADERS = {
    "User-Agent":
        "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36",
    Accept: "application/json, text/plain, */*",
    Origin: BASE_URL,
    Referer: BASE_URL + "/"
};

function generatePackageName(appName) {
    const cleaned = String(appName || "app")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
    return "com." + (cleaned || "webapp") + ".app";
}

function getQuoted(message) {
    return (
        message?.message?.extendedTextMessage?.contextInfo?.quotedMessage ||
        message?.message?.imageMessage?.contextInfo?.quotedMessage ||
        null
    );
}

async function downloadQuotedImage(quoted) {
    const imageMsg = quoted.imageMessage;
    if (!imageMsg) return null;

    const stream = await downloadContentFromMessage(imageMsg, "image");
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    return Buffer.concat(chunks);
}

async function buildApk(websiteUrl, appName, iconBuffer, packageName, versionName) {
    const iconPath = path.join(
        os.tmpdir(),
        "venom_icon_" + Date.now() + ".jpg"
    );
    fs.writeFileSync(iconPath, iconBuffer);

    try {
        const form = new FormData();
        form.append("websiteUrl", websiteUrl);
        form.append("appName", appName);
        form.append("icon", fs.createReadStream(iconPath));
        form.append("packageName", packageName || generatePackageName(appName));
        form.append("versionName", versionName || "1.0.0");
        form.append("versionCode", "1");

        const { data } = await axios.post(BASE_URL + "/api/build-apk", form, {
            headers: Object.assign({}, HEADERS, form.getHeaders()),
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
            timeout: 180000
        });

        if (data && data.success && data.downloadUrl) {
            data.fullDownloadUrl = data.downloadUrl.startsWith("http")
                ? data.downloadUrl
                : BASE_URL + data.downloadUrl;
        }
        return data;
    } finally {
        try {
            if (fs.existsSync(iconPath)) fs.unlinkSync(iconPath);
        } catch (e) {}
    }
}

module.exports = {
    name: "web2apk",
    aliases: ["toapp", "webtoapp", "site2apk"],

    run: async function ({ sock, from, args, reply, message }) {
        const quoted = getQuoted(message);

        if (!quoted || !quoted.imageMessage) {
            return reply(
`╭━━〔 📱 VENOM X WEB2APK 〕━━⬣

Reply to an *image* (app icon) with:

#web2apk <url> | <app name>
#web2apk <url> | <app name> | <package>
#web2apk <url> | <app name> | <package> | <version>

Example:
#web2apk https://fast.com | My Fast
#web2apk https://youtube.com | YouTube Pro | com.yt.pro | 1.0.0

╰━━━━━━━━━━━━━━━━⬣`
            );
        }

        const fullText = (args || []).join(" ").trim();
        const parts = fullText.split("|").map(function (s) {
            return s.trim();
        });

        let url = parts[0] || "";
        const appName = parts[1] || "";
        const packageName = parts[2] || "";
        const versionName = parts[3] || "1.0.0";

        // also support: #web2apk https://site.com AppName
        if (!appName && args.length >= 2 && parts.length === 1) {
            url = args[0];
            const nameJoin = args.slice(1).join(" ").trim();
            if (nameJoin) parts[1] = nameJoin;
        }

        const finalName = parts[1] || appName;

        if (!url || !finalName) {
            return reply(
                "❌ Format:\n#web2apk <url> | <app name>\n\nReply to an icon image."
            );
        }

        if (!/^https?:\/\//i.test(url)) {
            url = "https://" + url;
        }

        try {
            new URL(url);
        } catch (e) {
            return reply("❌ Invalid URL.");
        }

        try {
            await reply("📥 Downloading icon...");
            const iconBuffer = await downloadQuotedImage(quoted);
            if (!iconBuffer || iconBuffer.length < 100) {
                return reply("❌ Failed to download icon image.");
            }

            await reply("🔨 Building APK...\nThis may take a few minutes.");

            const result = await buildApk(
                url,
                finalName,
                iconBuffer,
                packageName || generatePackageName(finalName),
                versionName
            );

            if (!result || !result.success) {
                return reply(
                    "❌ Build failed:\n" +
                        ((result && result.message) || "Unknown error / API down")
                );
            }

            if (!result.fullDownloadUrl) {
                return reply("❌ Build OK but no download URL returned.");
            }

            await reply("📦 Downloading APK...");

            const apkRes = await axios.get(result.fullDownloadUrl, {
                responseType: "arraybuffer",
                timeout: 120000,
                maxContentLength: 80 * 1024 * 1024,
                headers: HEADERS
            });

            const apkBuffer = Buffer.from(apkRes.data);
            if (apkBuffer.length < 1000) {
                return reply("❌ APK download empty/failed.");
            }

            const fileName =
                finalName.replace(/\s+/g, "_") + "-" + versionName + ".apk";
            const finalPackage = packageName || generatePackageName(finalName);

            await sock.sendMessage(
                from,
                {
                    document: apkBuffer,
                    mimetype: "application/vnd.android.package-archive",
                    fileName: fileName,
                    caption:
                        "📱 Web2APK ✅\n\n" +
                        "📌 Name: " + finalName + "\n" +
                        "📦 Package: " + finalPackage + "\n" +
                        "📌 Version: " + versionName + "\n" +
                        "🔗 URL: " + url + "\n" +
                        "⚡ VENOM X"
                },
                { quoted: message }
            );
        } catch (error) {
            console.log("WEB2APK ERROR:", error.message);
            return reply("❌ Failed:\n" + (error.message || "Unknown error"));
        }
    }
};
