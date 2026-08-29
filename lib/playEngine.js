const fs = require("fs");
const path = require("path");
const yt = require("./youtube");

async function getAudio(query) {
    if (!query || !String(query).trim()) {
        throw new Error("Please provide a song name.");
    }

    const input = String(query).trim();

    // Use the SAME YouTube engine that #ytmp3 already uses.
    const data = input.startsWith("http")
        ? await yt.info(input)
        : await yt.search(input);

    if (!data?.webpage_url) {
        throw new Error("Could not find a valid YouTube result.");
    }

    const title = yt.sanitize(data.title || "VENOM-X");

    const output = path.join(
        yt.TMP,
        `${title}.mp3`
    );

    return {
        url: data.webpage_url,
        title: data.title || title,
        uploader: data.uploader || "YouTube",
        duration: data.duration_string || "Unknown",
        file: output
    };
}

function cleanup(file) {
    if (!file) return;

    try {
        if (fs.existsSync(file)) {
            fs.unlinkSync(file);
        }
    } catch (error) {
        console.log(
            "PLAY CLEANUP ERROR:",
            error.message
        );
    }
}

module.exports = {
    getAudio,
    cleanup
};
