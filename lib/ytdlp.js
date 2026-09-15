const fs = require("fs");
const path = require("path");
const os = require("os");
const https = require("https");
const { execFile } = require("child_process");
const { promisify } = require("util");
const execFileAsync = promisify(execFile);

const BIN = path.join(os.tmpdir(), "venom-yt-dlp");

function downloadFile(url, dest) {
    return new Promise(function (resolve, reject) {
        const file = fs.createWriteStream(dest);
        https
            .get(url, function (res) {
                if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    file.close();
                    try {
                        fs.unlinkSync(dest);
                    } catch (e) {}
                    return downloadFile(res.headers.location, dest).then(resolve).catch(reject);
                }
                if (res.statusCode !== 200) {
                    return reject(new Error("HTTP " + res.statusCode));
                }
                res.pipe(file);
                file.on("finish", function () {
                    file.close(resolve);
                });
            })
            .on("error", reject);
    });
}

async function getYtDlp() {
    const candidates = ["yt-dlp", "yt-dlp_linux", BIN];
    for (let i = 0; i < candidates.length; i++) {
        try {
            await execFileAsync(candidates[i], ["--version"], { timeout: 15000 });
            return candidates[i];
        } catch (e) {}
    }

    await downloadFile(
        "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp",
        BIN
    );
    fs.chmodSync(BIN, 0o755);
    await execFileAsync(BIN, ["--version"], { timeout: 20000 });
    return BIN;
}

async function runYtDlp(args, opts) {
    const bin = await getYtDlp();
    const finalArgs = Array.isArray(args) ? args.slice() : [];

    // Optional cookies from Render env (Netscape cookies.txt content)
    if (process.env.YT_COOKIES) {
        const cookieFile = path.join(os.tmpdir(), "venom-yt-cookies.txt");
        try {
            fs.writeFileSync(cookieFile, process.env.YT_COOKIES);
            finalArgs.unshift("--cookies", cookieFile);
        } catch (e) {}
    }

    try {
        return await execFileAsync(
            bin,
            finalArgs,
            Object.assign(
                { timeout: 180000, maxBuffer: 30 * 1024 * 1024 },
                opts || {}
            )
        );
    } catch (err) {
        const detail =
            (err.stderr && String(err.stderr).slice(0, 500)) ||
            err.message ||
            "yt-dlp failed";
        throw new Error(detail);
    }
}

module.exports = { getYtDlp, runYtDlp };
