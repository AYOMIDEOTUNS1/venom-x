const axios = require("axios");

module.exports = {
    name: "tiktok",

    aliases: [
        "tt",
        "ttinfo",
        "ttphoto",
        "ttmp3"
    ],

    run: async ({
        sock,
        from,
        args,
        reply,
        message,
        commandName
    }) => {

        // ================================================
        // GET TIKTOK URL
        // ================================================

        let url = "";

        const body =
            message?.message?.conversation ||
            message?.message?.extendedTextMessage?.text ||
            "";

        if (args.length) {
            url = args.join(" ").trim();
        }

        // If no argument, try quoted message
        if (!url) {

            const context =
                message?.message?.extendedTextMessage?.contextInfo ||
                message?.message?.imageMessage?.contextInfo ||
                message?.message?.videoMessage?.contextInfo ||
                {};

            const quoted =
                context.quotedMessage;

            if (quoted) {

                url =
                    quoted.conversation ||
                    quoted.extendedTextMessage?.text ||
                    quoted.imageMessage?.caption ||
                    quoted.videoMessage?.caption ||
                    "";
            }
        }

        if (!url) {
            return reply(
`╭━━〔 🎵 VENOM X TIKTOK 〕━━⬣
┃
┃ Usage:
┃ #tt <TikTok Link>
┃
┃ Info:
┃ #ttinfo <TikTok Link>
┃
┃ Audio:
┃ #ttmp3 <TikTok Link>
┃
┃ Photo:
┃ #ttphoto <TikTok Link>
┃
┃ Or reply to a TikTok link:
┃ #tt
╰━━━━━━━━━━━━━━━━⬣`
            );
        }

        // ================================================
        // CLEAN URL
        // ================================================

        url = url.trim();

        if (url.includes("?")) {
            url = url.split("?")[0];
        }

        // ================================================
        // VALIDATE TIKTOK
        // ================================================

        if (
            !url.includes("tiktok.com") &&
            !url.includes("vm.tiktok.com") &&
            !url.includes("vt.tiktok.com")
        ) {
            return reply("❌ Invalid TikTok link.");
        }

        // ================================================
        // REACTION
        // ================================================

        try {
            await sock.sendMessage(from, {
                react: {
                    text: "⏳",
                    key: message.key
                }
            });
        } catch {}

        try {

            // ============================================
            // FETCH DATA
            // ============================================

            let data = null;

            try {

                const response = await axios.get(
                    "https://www.tikwm.com/api/",
                    {
                        params: {
                            url
                        },
                        timeout: 30000
                    }
                );

                data = response.data;

            } catch (firstError) {

                console.log(
                    "TIKWM PRIMARY ERROR:",
                    firstError.message
                );

                const response = await axios.get(
                    "https://tikwm.com/api/",
                    {
                        params: {
                            url
                        },
                        timeout: 30000
                    }
                );

                data = response.data;
            }

            // ============================================
            // VALIDATE RESPONSE
            // ============================================

            if (
                !data ||
                !data.data
            ) {
                console.log(
                    "TIKTOK API RESPONSE:",
                    JSON.stringify(data)
                );

                return reply(
                    "❌ Unable to fetch this TikTok. Try another link."
                );
            }

            const t = data.data;

            // ============================================
            // FORMAT NUMBERS
            // ============================================

            const format = (number) => {

                if (!number) {
                    return "0";
                }

                if (number >= 1000000) {
                    return (
                        number / 1000000
                    ).toFixed(1) + "M";
                }

                if (number >= 1000) {
                    return (
                        number / 1000
                    ).toFixed(1) + "K";
                }

                return String(number);
            };

            // ============================================
            // INFORMATION
            // ============================================

            const info =
`╭━━〔 🎵 VENOM X TIKTOK 〕━━⬣
┃
┃ 👤 Author : ${t.author?.nickname || "Unknown"}
┃ 🌍 Region : ${t.region || "Unknown"}
┃ ❤️ Likes : ${format(t.digg_count)}
┃ 💬 Comments : ${format(t.comment_count)}
┃ 🔁 Shares : ${format(t.share_count)}
┃ 👀 Views : ${format(t.play_count)}
┃ ⏱ Duration : ${t.duration || 0}s
┃ 🎵 Music : ${t.music_info?.title || "Original Sound"}
┃
┃ 📝 Caption
┃ ${t.title || "No caption"}
╰━━━━━━━━━━━━━━━━⬣`;

            // ============================================
            // INFO ONLY
            // ============================================

            if (commandName === "ttinfo") {

                await reply(info);

                try {
                    await sock.sendMessage(from, {
                        react: {
                            text: "ℹ️",
                            key: message.key
                        }
                    });
                } catch {}

                return;
            }

            // ============================================
            // AUDIO ONLY
            // ============================================

            if (commandName === "ttmp3") {

                if (!t.music) {
                    return reply(
                        "❌ TikTok audio is unavailable."
                    );
                }

                await reply(info);

                await sock.sendMessage(
                    from,
                    {
                        audio: {
                            url: t.music
                        },
                        mimetype: "audio/mpeg",
                        ptt: false
                    },
                    {
                        quoted: message
                    }
                );

                try {
                    await sock.sendMessage(from, {
                        react: {
                            text: "🎵",
                            key: message.key
                        }
                    });
                } catch {}

                return;
            }

            // ============================================
            // PHOTO / SLIDESHOW
            // ============================================

            if (commandName === "ttphoto") {

                if (
                    !Array.isArray(t.images) ||
                    !t.images.length
                ) {
                    return reply(
                        "❌ This TikTok is not a photo slideshow."
                    );
                }

                await reply(info);

                for (const image of t.images) {

                    if (!image) continue;

                    await sock.sendMessage(
                        from,
                        {
                            image: {
                                url: image
                            }
                        },
                        {
                            quoted: message
                        }
                    );
                }

                try {
                    await sock.sendMessage(from, {
                        react: {
                            text: "🖼️",
                            key: message.key
                        }
                    });
                } catch {}

                return;
            }

            // ============================================
            // NORMAL TIKTOK DOWNLOAD
            // ============================================

            if (
                Array.isArray(t.images) &&
                t.images.length
            ) {

                await reply(info);

                for (const image of t.images) {

                    if (!image) continue;

                    await sock.sendMessage(
                        from,
                        {
                            image: {
                                url: image
                            }
                        },
                        {
                            quoted: message
                        }
                    );
                }

            } else {

                const videoUrl =
                    t.hdplay ||
                    t.play;

                if (!videoUrl) {
                    return reply(
                        "❌ No playable TikTok video was returned."
                    );
                }

                await sock.sendMessage(
                    from,
                    {
                        video: {
                            url: videoUrl
                        },
                        caption: info
                    },
                    {
                        quoted: message
                    }
                );

                if (t.music) {

                    await sock.sendMessage(
                        from,
                        {
                            audio: {
                                url: t.music
                            },
                            mimetype: "audio/mpeg",
                            ptt: false
                        },
                        {
                            quoted: message
                        }
                    );
                }
            }

            // ============================================
            // SUCCESS
            // ============================================

            try {
                await sock.sendMessage(from, {
                    react: {
                        text: "✅",
                        key: message.key
                    }
                });
            } catch {}

        } catch (error) {

            console.error(
                "TIKTOK ERROR:",
                error.message
            );

            try {
                await sock.sendMessage(from, {
                    react: {
                        text: "❌",
                        key: message.key
                    }
                });
            } catch {}

            return reply(
`╭━━〔 ❌ VENOM X TIKTOK 〕━━⬣
┃
┃ ❌ Failed to process TikTok.
┃
┃ Try another TikTok link.
╰━━━━━━━━━━━━━━━━⬣`
            );
        }
    }
};
