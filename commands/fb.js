const fs = require("fs");
const path = require("path");
const os = require("os");
const https = require("https");
const { execFile } = require("child_process");
const { promisify } = require("util");

const execFileAsync = promisify(execFile);
const { runYtDlp, getYtDlp } = require("../lib/ytdlp");

function isUrl(text) {
    return /^https?:\/\//i.test(String(text || "").trim());
}

function downloadFile(url, dest) {
    return new Promise(function (resolve, reject) {
        const file = fs.createWriteStream(dest);
        https
            .get(url, function (res) {
                if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    file.close();
                    fs.unlink(dest, function () {});
                    return downloadFile(res.headers.location, dest).then(resolve).catch(reject);
                }
                if (res.statusCode !== 200) {
                    reject(new Error("HTTP " + res.statusCode));
                    return;
                }
                res.pipe(file);
                file.on("finish", function () {
                    file.close(resolve);
                });
            })
            .on("error", function (err) {
                try {
                    fs.unlinkSync(dest);
                } catch (e) {}
                reject(err);
            });
    });
}

async function resolveYtDlp() {
    const candidates = ["yt-dlp", "yt-dlp_linux", path.join(os.tmpdir(), "venom-yt-dlp")];

    for (let i = 0; i < candidates.length; i++) {
        const bin = candidates[i];
        try {
            await execFileAsync(bin, ["--version"], { timeout: 15000 });
            return bin;
        } catch (e) {}
    }

    // download standalone binary once
    const dest = path.join(os.tmpdir(), "venom-yt-dlp");
    const url =
        "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp";
    try {
        if (!fs.existsSync(dest) || fs.statSync(dest).size < 10000) {
            await downloadFile(url, dest);
            fs.chmodSync(dest, 0o755);
        }
        await execFileAsync(dest, ["--version"], { timeout: 15000 });
        return dest;
    } catch (e) {
        throw new Error(
            "yt-dlp missing and auto-install failed: " + (e.message || e)
        );
    }
}

module.exports = {
    name: "fb",
    aliases: ["facebook", "fbdl"],

    run: async function ({ sock, from, args, reply, message }) {
        if (!args.length) {
            return reply(
`╭━━〔 📘 VENOM X FACEBOOK 〕━━⬣

Usage:
#fb <Facebook video / Reel URL>

Example:
#fb https://www.facebook.com/reel/...
#fb https://fb.watch/...

⚠️ Public videos only.

╰━━━━━━━━━━━━━━━━⬣`
            );
        }

        const url = args.join(" ").trim();
        if (!isUrl(url)) {
            return reply("❌ Send a valid Facebook URL.");
        }

        const tempDir = await fs.promises.mkdtemp(
            path.join(os.tmpdir(), "venom-fb-")
        );
        const output = path.join(tempDir, "facebook.%(ext)s");

        try {
            await reply("📘 Facebook: preparing...\n⏳ Please wait.");

            const ytdlp = await resolveYtDlp();

            await reply("⬇️ Downloading video...");

            try {
                await execFileAsync(
                    ytdlp,
                    [
                        "--no-playlist",
                        "--no-warnings",
                        "--restrict-filenames",
                        "--user-agent",
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36",
                        "-f",
                        "bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/best",
                        "--merge-output-format",
                        "mp4",
                        "-o",
                        output,
                        url
                    ],
                    { timeout: 180000, maxBuffer: 20 * 1024 * 1024 }
                );
            } catch (err) {
                const detail =
                    (err && err.stderr && String(err.stderr).slice(0, 350)) ||
                    (err && err.message) ||
                    "download failed";
                throw new Error(detail);
            }

            const files = await fs.promises.readdir(tempDir);
            const videoFile = files.find(function (f) {
                return /\.(mp4|mkv|webm|mov)$/i.test(f);
            });
            if (!videoFile) throw new Error("Video file was not created.");

            const buffer = await fs.promises.readFile(path.join(tempDir, videoFile));
            if (buffer.length < 1000) throw new Error("Downloaded file is empty.");

            await sock.sendMessage(
                from,
                {
                    video: buffer,
                    mimetype: "video/mp4",
                    caption: "✅ Facebook video\n⚡ VENOM X"
                },
                { quoted: message }
            );
        } catch (error) {
            console.log("FACEBOOK DOWNLOAD ERROR:", error.message);
            return reply(
`╭━━〔 ❌ VENOM X FACEBOOK 〕━━⬣

${String(error.message || "").slice(0, 500)}

Tips:
• Public Reel / fb.watch link only
• Private videos not supported

╰━━━━━━━━━━━━━━━━⬣`
            );
        } finally {
            try {
                await fs.promises.rm(tempDir, { recursive: true, force: true });
            } catch (e) {}
        }
    }
};
