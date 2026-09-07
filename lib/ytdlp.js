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
        https.get(url, function (res) {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                file.close();
                try { fs.unlinkSync(dest); } catch (e) {}
                return downloadFile(res.headers.location, dest).then(resolve).catch(reject);
            }
            if (res.statusCode !== 200) return reject(new Error("HTTP " + res.statusCode));
            res.pipe(file);
            file.on("finish", function () { file.close(resolve); });
        }).on("error", reject);
    });
}

async function getYtDlp() {
    for (const bin of ["yt-dlp", BIN]) {
        try {
            await execFileAsync(bin, ["--version"], { timeout: 15000 });
            return bin;
        } catch (e) {}
    }
    await downloadFile(
        "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp",
        BIN
    );
    fs.chmodSync(BIN, 0o755);
    await execFileAsync(BIN, ["--version"], { timeout: 15000 });
    return BIN;
}

async function runYtDlp(args, opts) {
    const bin = await getYtDlp();
    try {
        return await execFileAsync(
            bin,
            args,
            Object.assign({ timeout: 180000, maxBuffer: 30 * 1024 * 1024 }, opts || {})
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
