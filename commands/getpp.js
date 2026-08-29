module.exports = {
    aliases: ["pp", "profilepic", "profile"],

    async run({
        sock,
        from,
        sender,
        message,
        args,
        reply
    }) {

        try {

            // =================================================
            // FIND TARGET
            // =================================================

            let target = null;

            // -------------------------------------------------
            // 1. MENTIONED USER
            // -------------------------------------------------

            const mentioned =
                message?.message
                    ?.extendedTextMessage
                    ?.contextInfo
                    ?.mentionedJid;

            if (
                Array.isArray(mentioned) &&
                mentioned.length
            ) {
                target = mentioned[0];
            }

            // -------------------------------------------------
            // 2. REPLIED USER
            // -------------------------------------------------

            if (!target) {

                const quoted =
                    message?.message
                        ?.extendedTextMessage
                        ?.contextInfo
                        ?.participant;

                if (quoted) {
                    target = quoted;
                }
            }

            // -------------------------------------------------
            // 3. OWN PROFILE
            // -------------------------------------------------

            if (!target) {
                target = sender;
            }

            if (!target) {
                await reply(
                    "❌ I couldn't determine the user."
                );

                return;
            }

            console.log(
                "🖼️ GETPP TARGET:",
                target
            );

            // =================================================
            // GET PROFILE PICTURE
            // =================================================

            let url = null;

            try {

                url =
                    await sock.profilePictureUrl(
                        target,
                        "image"
                    );

            } catch {

                // Try phone-number JID if available.
                const clean =
                    String(target)
                        .replace(/\D/g, "");

                if (clean) {

                    try {

                        url =
                            await sock.profilePictureUrl(
                                `${clean}@s.whatsapp.net`,
                                "image"
                            );

                    } catch {}
                }
            }

            // =================================================
            // NO PROFILE PICTURE
            // =================================================

            if (!url) {

                await reply(
                    "❌ This user has no accessible profile picture."
                );

                return;
            }

            // =================================================
            // DOWNLOAD IMAGE
            // =================================================

            const axios =
                require("axios");

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

            const image =
                Buffer.from(
                    response.data
                );

            // =================================================
            // SEND PROFILE PICTURE
            // =================================================

            await sock.sendMessage(
                from,
                {
                    image,

                    caption:
                        `🖼️ *PROFILE PICTURE*\n\n` +
                        `👤 @${String(target)
                            .split("@")[0]
                            .split(":")[0]}`,

                    mentions: [
                        target
                    ]
                },
                {
                    quoted: message
                }
            );

            console.log(
                "✅ GETPP SENT:",
                target
            );

        } catch (error) {

            console.log(
                "❌ GETPP ERROR:",
                error.message
            );

            await reply(
                "❌ Couldn't retrieve the profile picture."
            ).catch(() => {});
        }
    }
};
