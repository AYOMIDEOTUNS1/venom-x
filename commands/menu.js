/**
 * VENOM X - Carousel Menu (Silent Tech style)
 * Full command categories
 */

const axios = require("axios");
const fs = require("fs");
const path = require("path");

const SETTINGS_FILE = path.join(__dirname, "..", "settings.json");

function getSettings() {
    try {
        return JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf8"));
    } catch (e) {
        return {};
    }
}

function getTimeInfo() {
    const now = new Date();
    const time = new Intl.DateTimeFormat("en-NG", {
        timeZone: "Africa/Lagos",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true
    }).format(now);
    const hour = Number(
        new Intl.DateTimeFormat("en-NG", {
            timeZone: "Africa/Lagos",
            hour: "numeric",
            hour12: false
        }).format(now)
    );
    let greeting = "Good night";
    if (hour >= 5 && hour < 12) greeting = "Good morning";
    else if (hour >= 12 && hour < 17) greeting = "Good afternoon";
    else if (hour >= 17 && hour < 22) greeting = "Good evening";
    return { time, greeting };
}

module.exports = {
    name: "menu",
    aliases: ["m", "help", "list"],

    run: async function ({ sock, from, sender, message, reply, settings }) {
        const conf = settings || getSettings();
        const prefix = conf.prefix || "#";
        const botName = conf.botName || "VENOM X";
        const ownerName = conf.ownerName || "AYOMIDE";
        const p = prefix;
        const t = getTimeInfo();

        let total = 0;
        try {
            if (typeof sock.getCommands === "function") {
                total = sock.getCommands().size || 0;
            }
        } catch (e) {}

        try {
            await sock.sendMessage(from, {
                react: { text: "⏳", key: message.key }
            });
        } catch (e) {}

        try {
            const {
                prepareWAMessageMedia,
                generateWAMessageFromContent,
                proto
            } = require("@whiskeysockets/baileys");

            // optional gif — set MENU_GIF_URL or settings.menuGif
            let media = null;
            const gifUrl =
                conf.menuGif ||
                process.env.MENU_GIF_URL ||
                "https://7cfmjruljx39o3gt.public.blob.vercel-storage.com/uploads/guest_48bcfcd0531d3dac12/1791148290118_video.gif";

            try {
                const { data: gifBuffer } = await axios.get(gifUrl, {
                    responseType: "arraybuffer",
                    timeout: 8000,
                    headers: { "User-Agent": "VENOM-X" }
                });
                media = await prepareWAMessageMedia(
                    {
                        video: Buffer.from(gifBuffer),
                        gifPlayback: true
                    },
                    { upload: sock.waUploadToServer }
                );
            } catch (mediaError) {
                console.log("[MENU WARNING] GIF failed, cards without media");
            }

            // full categories = your real menu cmds
            const categories = [
                {
                    title: "🧠 AI",
                    desc:
                        p + "ai\n" +
                        p + "ask\n" +
                        p + "venomai\n" +
                        p + "gpt\n" +
                        p + "nano\n" +
                        p + "secret\n" +
                        p + "translate\n" +
                        p + "rewrite\n" +
                        p + "summarize\n" +
                        p + "code\n" +
                        p + "define\n" +
                        p + "wiki\n" +
                        p + "summary",
                    id: p + "ai",
                    btnText: "🧠 AI Cmds"
                },
                {
                    title: "🎨 IMAGE",
                    desc:
                        p + "hd\n" +
                        p + "tohd\n" +
                        p + "sticker\n" +
                        p + "s\n" +
                        p + "toimg\n" +
                        p + "tovid\n" +
                        p + "cropsticker\n" +
                        p + "getpp\n" +
                        p + "stickerpack\n" +
                        p + "take\n" +
                        p + "steal\n" +
                        p + "takeall\n" +
                        p + "animepic\n" +
                        p + "pint\n" +
                        p + "pinterest\n" +
                        p + "wallpaper\n" +
                        p + "character\n" +
                        p + "blur\n" +
                        p + "removebg\n" +
                        p + "wanted",
                    id: p + "sticker",
                    btnText: "🎨 Image Cmds"
                },
                {
                    title: "🔞 NSFW",
                    desc:
                        p + "xv\n" +
                        p + "xvphoto\n" +
                        p + "xnxx\n" +
                        p + "ass\n" +
                        p + "boobs\n" +
                        p + "hentai\n" +
                        p + "waifu\n" +
                        p + "deepnude\n" +
                        p + "neko\n" +
                        p + "pussy\n" +
                        p + "mature",
                    id: p + "xv",
                    btnText: "🔞 NSFW Cmds"
                },
                {
                    title: "📥 DOWNLOADS",
                    desc:
                        p + "tiktok\n" +
                        p + "tt\n" +
                        p + "ytmp3\n" +
                        p + "ytmp4\n" +
                        p + "ig\n" +
                        p + "instagram\n" +
                        p + "fb\n" +
                        p + "facebook\n" +
                        p + "play\n" +
                        p + "spotify\n" +
                        p + "mediafire\n" +
                        p + "vv\n" +
                        p + "vv2\n" +
                        p + "tiktokboost\n" +
                        p + "ttstalk",
                    id: p + "play",
                    btnText: "📥 Download Cmds"
                },
                {
                    title: "🎵 MUSIC / AUDIO",
                    desc:
                        p + "play\n" +
                        p + "song\n" +
                        p + "music\n" +
                        p + "spotify\n" +
                        p + "ytmp3\n" +
                        p + "tomp3\n" +
                        p + "bass\n" +
                        p + "reverse\n" +
                        p + "tts",
                    id: p + "spotify",
                    btnText: "🎵 Audio Cmds"
                },
                {
                    title: "👥 GROUP",
                    desc:
                        p + "tagall\n" +
                        p + "hidetag\n" +
                        p + "kick\n" +
                        p + "add\n" +
                        p + "promote\n" +
                        p + "demote\n" +
                        p + "warn\n" +
                        p + "warnings\n" +
                        p + "delwarn\n" +
                        p + "resetwarn\n" +
                        p + "antilink\n" +
                        p + "antichannelmessage\n" +
                        p + "antistatustag\n" +
                        p + "welcome\n" +
                        p + "goodbye\n" +
                        p + "open\n" +
                        p + "close\n" +
                        p + "groupinfo\n" +
                        p + "invite\n" +
                        p + "grouplink\n" +
                        p + "revoke\n" +
                        p + "resetlink\n" +
                        p + "grouppfp\n" +
                        p + "status2\n" +
                        p + "gcstatus\n" +
                        p + "leave",
                    id: p + "invite",
                    btnText: "👥 Group Cmds"
                },
                {
                    title: "💰 ECONOMY",
                    desc:
                        p + "bal\n" +
                        p + "daily\n" +
                        p + "weekly\n" +
                        p + "monthly\n" +
                        p + "work\n" +
                        p + "deposit\n" +
                        p + "withdraw\n" +
                        p + "pay\n" +
                        p + "rob\n" +
                        p + "jail\n" +
                        p + "bail\n" +
                        p + "escape\n" +
                        p + "economy\n" +
                        p + "bank\n" +
                        p + "bankupgrade\n" +
                        p + "market\n" +
                        p + "aza\n" +
                        p + "lb\n" +
                        p + "glb\n" +
                        p + "resetgame",
                    id: p + "bal",
                    btnText: "💰 Economy Cmds"
                },
                {
                    title: "🎮 GAMES",
                    desc:
                        p + "coinflip\n" +
                        p + "cf\n" +
                        p + "slots\n" +
                        p + "guess\n" +
                        p + "blackjack\n" +
                        p + "bj\n" +
                        p + "dice\n" +
                        p + "rps\n" +
                        p + "battle\n" +
                        p + "duel\n" +
                        p + "accept\n" +
                        p + "wordchain\n" +
                        p + "wc\n" +
                        p + "bird\n" +
                        p + "flap\n" +
                        p + "snake\n" +
                        p + "ttt\n" +
                        p + "hangman\n" +
                        p + "hack",
                    id: p + "bird",
                    btnText: "🎮 Game Cmds"
                },
                {
                    title: "😝 FUN MENU",
                    desc:
                        p + "fun\n" +
                        p + "funextra\n" +
                        p + "truth\n" +
                        p + "dare\n" +
                        p + "truthdare\n" +
                        p + "roast\n" +
                        p + "compliment\n" +
                        p + "flirt\n" +
                        p + "joke\n" +
                        p + "quote\n" +
                        p + "insult\n" +
                        p + "riddle\n" +
                        p + "ship\n" +
                        p + "pick\n" +
                        p + "couple\n" +
                        p + "meme\n" +
                        p + "nmeme\n" +
                        p + "style\n" +
                        p + "wouldyou\n" +
                        p + "dadjoke\n" +
                        p + "funfact\n" +
                        p + "advice\n" +
                        p + "rate\n" +
                        p + "ronaldo\n" +
                        p + "elonmusk\n" +
                        p + "therock\n" +
                        p + "zuck\n" +
                        p + "tiktok-girl\n" +
                        p + "korean-girl\n" +
                        p + "japan-girl\n" +
                        p + "itadori\n" +
                        p + "waifu\n" +
                        p + "neko",
                    id: p + "nmeme",
                    btnText: "😝 Fun Cmds"
                },
                {
                    title: "✨ ANIME",
                    desc:
                        p + "anime\n" +
                        p + "animelovers\n" +
                        p + "animepic\n" +
                        p + "waifu\n" +
                        p + "neko\n" +
                        p + "itadori\n" +
                        p + "quoteanime",
                    id: p + "anime",
                    btnText: "✨ Anime Cmds"
                },
                {
                    title: "🛠️ TOOLS",
                    desc:
                        p + "get\n" +
                        p + "url\n" +
                        p + "github\n" +
                        p + "web2apk\n" +
                        p + "reactch\n" +
                        p + "getjid\n" +
                        p + "whoami\n" +
                        p + "vcf\n" +
                        p + "save\n" +
                        p + "pair\n" +
                        p + "setfullpfp\n" +
                        p + "ban\n" +
                        p + "unban",
                    id: p + "get",
                    btnText: "🛠️ Tools Cmds"
                },
                {
                    title: "⚙️ UTILITY",
                    desc:
                        p + "ping\n" +
                        p + "p\n" +
                        p + "alive\n" +
                        p + "uptime\n" +
                        p + "up\n" +
                        p + "menu\n" +
                        p + "m\n" +
                        p + "help\n" +
                        p + "owner\n" +
                        p + "profile\n" +
                        p + "info\n" +
                        p + "delete\n" +
                        p + "del\n" +
                        p + "autoreact\n" +
                        p + "refresh\n" +
                        p + "sleep",
                    id: p + "ping",
                    btnText: "⚡ Utility Cmds"
                },
                {
                    title: "👑 OWNER",
                    desc:
                        p + "public\n" +
                        p + "private\n" +
                        p + "shutdown\n" +
                        p + "update\n" +
                        p + "block\n" +
                        p + "unblock\n" +
                        p + "sudo\n" +
                        p + "leave\n" +
                        p + "reset\n" +
                        p + "ban\n" +
                        p + "unban\n" +
                        p + "setfullpfp\n" +
                        p + "pair",
                    id: p + "owner",
                    btnText: "👑 Owner Cmds"
                }
            ];

            const cards = categories.map(function (cat) {
                let cardHeader = proto.Message.InteractiveMessage.Header.create({
                    title: " "
                });

                if (media && media.videoMessage) {
                    cardHeader = proto.Message.InteractiveMessage.Header.create({
                        title: " ",
                        hasMediaAttachment: true,
                        videoMessage: media.videoMessage
                    });
                }

                return {
                    body: proto.Message.InteractiveMessage.Body.create({
                        text:
                            "*" + cat.title + "*\n" +
                            cat.desc + "\n\n" +
                            "| © VENOM X"
                    }),
                    header: cardHeader,
                    nativeFlowMessage:
                        proto.Message.InteractiveMessage.NativeFlowMessage.create({
                            buttons: [
                                {
                                    name: "quick_reply",
                                    buttonParamsJson: JSON.stringify({
                                        display_text: cat.btnText,
                                        id: cat.id
                                    })
                                }
                            ]
                        })
                };
            });

            const interactiveMessage = proto.Message.InteractiveMessage.create({
                body: proto.Message.InteractiveMessage.Body.create({
                    text:
                        "> © VENOM X\n" +
                        "┏ ◆ " + t.greeting.toUpperCase() + "\n" +
                        "┗ ◆ " + t.time + "\n\n" +
                        "👋 Hey *@" + String(sender || "").split("@")[0] + "*\n" +
                        "✅ *" + botName + "* online\n" +
                        "📦 Commands: *" + total + "*\n" +
                        "👑 Owner: " + ownerName + "\n\n" +
                        "Swipe to explore all categories 📚"
                }),
                carouselMessage:
                    proto.Message.InteractiveMessage.CarouselMessage.create({
                        cards: cards,
                        messageVersion: 1
                    })
            });

            const msg = generateWAMessageFromContent(
                from,
                {
                    viewOnceMessage: {
                        message: {
                            messageContextInfo: {
                                deviceListMetadata: {},
                                deviceListMetadataVersion: 2
                            },
                            interactiveMessage: interactiveMessage
                        }
                    }
                },
                {
                    userJid: sock.user && sock.user.id,
                    quoted: message,
                    mentions: [sender]
                }
            );

            const additionalNodes = [
                {
                    tag: "biz",
                    attrs: {},
                    content: [
                        {
                            tag: "interactive",
                            attrs: { type: "native_flow", v: "1" },
                            content: [
                                {
                                    tag: "native_flow",
                                    attrs: { v: "2", name: "mixed" }
                                }
                            ]
                        }
                    ]
                }
            ];

            if (!String(from).endsWith("@g.us")) {
                additionalNodes[0].content.push({
                    tag: "bot",
                    attrs: { biz_bot: "1" }
                });
            }

            await sock.relayMessage(from, msg.message, {
                messageId: msg.key.id,
                additionalNodes: additionalNodes
            });

            try {
                await sock.sendMessage(from, {
                    react: { text: "✅", key: message.key }
                });
            } catch (e) {}
        } catch (e) {
            console.error("[MENU ERROR]", e);
            try {
                await sock.sendMessage(from, {
                    react: { text: "❌", key: message.key }
                });
            } catch (e2) {}
            return reply("🩸 Menu Error: " + (e.message || e));
        }
    }
};
