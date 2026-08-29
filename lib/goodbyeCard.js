const { Jimp } = require("jimp");
const axios = require("axios");
const fs = require("fs");
const path = require("path");

// ============================================================
// LOAD MEMBER PROFILE PICTURE
// ============================================================

async function loadAvatar(url) {

    if (
        !url ||
        typeof url !== "string"
    ) {
        return null;
    }

    try {

        console.log(
            "🖼️ Downloading member profile picture..."
        );

        const response =
            await axios.get(
                url,
                {
                    responseType:
                        "arraybuffer",

                    timeout: 10000,

                    maxContentLength:
                        15 * 1024 * 1024,

                    headers: {
                        "User-Agent":
                            "VENOM-X/3.0"
                    }
                }
            );

        if (
            !response.data
        ) {
            return null;
        }

        const avatar =
            await Jimp.read(
                Buffer.from(
                    response.data
                )
            );

        console.log(
            "✅ Member profile picture loaded."
        );

        return avatar;

    } catch (error) {

        console.log(
            "GOODBYE AVATAR ERROR:",
            error.message
        );

        return null;
    }
}

// ============================================================
// CREATE GOODBYE CARD
// FULL PROFILE PICTURE — NO TEXT
// ============================================================

async function createGoodbyeCard(
    name,
    group,
    members,
    avatarUrl
) {

    const WIDTH = 1000;
    const HEIGHT = 500;

    // ========================================================
    // GET MEMBER PROFILE PICTURE
    // ========================================================

    const avatar =
        await loadAvatar(
            avatarUrl
        );

    if (!avatar) {

        throw new Error(
            "Member profile picture could not be loaded."
        );
    }

    // ========================================================
    // RESIZE PROFILE PICTURE TO FULL CARD
    // ========================================================

    avatar.cover(
        WIDTH,
        HEIGHT
    );

    // ========================================================
    // CREATE CARD
    // ========================================================

    const image =
        new Jimp({
            width: WIDTH,
            height: HEIGHT
        });

    // ========================================================
    // FULL PROFILE PICTURE
    // ========================================================

    image.composite(
        avatar,
        0,
        0
    );

    // ========================================================
    // OUTPUT
    // ========================================================

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

    const output =
        path.join(
            tempFolder,
            `goodbye_${Date.now()}_${Math.random()
                .toString(36)
                .slice(2, 8)}.png`
        );

    await image.write(
        output
    );

    console.log(
        "✅ Full member profile picture goodbye card created."
    );

    return output;
}

// ============================================================
// EXPORT
// ============================================================

module.exports = {
    createGoodbyeCard
};
