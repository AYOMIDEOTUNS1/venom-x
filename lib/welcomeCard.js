const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { Jimp } = require("jimp");

// ============================================================
// DOWNLOAD MEMBER PROFILE PICTURE
// ============================================================

async function downloadMemberPicture(url) {

    if (!url || typeof url !== "string") {
        return null;
    }

    try {

        console.log("🖼️ Downloading member profile picture...");

        const response = await axios.get(url, {
            responseType: "arraybuffer",
            timeout: 10000,
            maxContentLength: 15 * 1024 * 1024,
            headers: {
                "User-Agent": "VENOM-X/3.0"
            }
        });

        if (!response.data) {
            return null;
        }

        const buffer = Buffer.from(response.data);

        const image = await Jimp.read(buffer);

        console.log("✅ Member profile picture loaded.");

        return image;

    } catch (error) {

        console.log(
            "❌ MEMBER PICTURE ERROR:",
            error.message
        );

        return null;
    }
}

// ============================================================
// CREATE FULL PROFILE PICTURE CARD
// ============================================================

async function createWelcomeCard(
    username,
    groupName,
    members,
    avatarUrl
) {

    // --------------------------------------------------------
    // Download avatar
    // --------------------------------------------------------

    const avatar =
        await downloadMemberPicture(
            avatarUrl
        );

    if (!avatar) {
        throw new Error(
            "Could not download member profile picture."
        );
    }

    // --------------------------------------------------------
    // Create output folder
    // --------------------------------------------------------

    const tempFolder =
        path.join(
            process.cwd(),
            "temp"
        );

    fs.mkdirSync(
        tempFolder,
        {
            recursive: true
        }
    );

    // --------------------------------------------------------
    // Keep the FULL picture
    //
    // No text
    // No background
    // No cropping
    // --------------------------------------------------------

    const WIDTH = 1000;
    const HEIGHT = 1000;

    avatar.resize({
        w: WIDTH,
        h: HEIGHT
    });

    // --------------------------------------------------------
    // Output
    // --------------------------------------------------------

    const output =
        path.join(
            tempFolder,
            `welcome_${Date.now()}_${Math.random()
                .toString(36)
                .slice(2, 8)}.jpg`
        );

    await avatar.write(output);

    console.log(
        "✅ Full member profile picture card created."
    );

    return output;
}

// ============================================================
// EXPORT
// ============================================================

module.exports = {
    createWelcomeCard
};
