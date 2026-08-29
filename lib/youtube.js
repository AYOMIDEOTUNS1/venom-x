const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const TMP = path.join(__dirname, "..", "temp");

if (!fs.existsSync(TMP)) {
    fs.mkdirSync(TMP, { recursive: true });
}

function sanitize(name = "") {
    return name
        .replace(/[\\/:*?"<>|]/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

function run(command, args = []) {
    return new Promise((resolve, reject) => {

        const proc = spawn(command, args);

        let stdout = "";
        let stderr = "";

        proc.stdout.on("data", d => stdout += d);
        proc.stderr.on("data", d => stderr += d);

        proc.on("error", reject);

        proc.on("close", code => {

            if (code === 0) {
                resolve(stdout.trim());
            } else {
                reject(new Error(stderr || "yt-dlp failed."));
            }

        });

    });
}

async function search(query) {

    const out = await run("yt-dlp", [
        `ytsearch1:${query}`,
        "--dump-single-json",
        "--no-playlist"
    ]);

    return JSON.parse(out);

}

async function playlist(query) {

    const out = await run("yt-dlp", [
        `ytsearch5:${query}`,
        "--flat-playlist",
        "--dump-single-json"
    ]);

    return JSON.parse(out);

}

async function info(url) {

    const out = await run("yt-dlp", [
        url,
        "--dump-single-json",
        "--no-playlist"
    ]);

    return JSON.parse(out);

}

async function thumbnail(input) {

    const data =
        input.startsWith("http")
            ? await info(input)
            : await search(input);

    return data.thumbnail || null;

}

async function exists() {

    try {

        await run("yt-dlp", ["--version"]);

        return true;

    } catch {

        return false;

    }

}

module.exports = {
    TMP,
    sanitize,
    run,
    search,
    playlist,
    info,
    thumbnail,
    exists
};
