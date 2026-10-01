/**
 * VENOM X - #tts
 * Text to speech via OmegaTech Clideo API
 *
 * #tts Hello gang
 * #tts Hello | EXCITED
 * #tts Hello | en
 */

const axios = require("axios");

function getQuotedText(message) {
    const ctx =
        message.message &&
        message.message.extendedTextMessage &&
        message.message.extendedTextMessage.contextInfo
            ? message.message.extendedTextMessage.contextInfo
            : null;

    if (!ctx || !ctx.quotedMessage) return "";

    let q = ctx.quotedMessage;
    for (let i = 0; i < 5; i++) {
        const wrap =
            (q.ephemeralMessage && q.ephemeralMessage.message) ||
            (q.viewOnceMessage && q.viewOnceMessage.message) ||
            (q.viewOnceMessageV2 && q.viewOnceMessageV2.message) ||
            null;
        if (!wrap) break;
        q = wrap;
    }

    return (
        q.conversation ||
        (q.extendedTextMessage && q.extendedTextMessage.text) ||
        (q.imageMessage && q.imageMessage.caption) ||
        (q.videoMessage && q.videoMessage.caption) ||
        ""
    );
}

module.exports = {
    name: "tts",
    aliases: ["say", "speak", "voice"],

    run: async function ({ sock, from, args, reply, message }) {
        let input = (args || []).join(" ").trim();
        if (!input) input = String(getQuotedText(message) || "").trim();

        if (!input) {
            return reply(
"╭━━〔 🗣️ VENOM TTS 〕━━⬣\n" +
"┃\n" +
"┃ Usage:\n" +
"┃ #tts <text>\n" +
"┃ #tts Hello gang\n" +
"┃ #tts Hello | EXCITED\n" +
"┃ #tts Hola | es\n" +
"┃\n" +
"┃ Moods: NORMAL, EXCITED, SAD...\n" +
"┃ Lang: En, es, fr, ...\n" +
"┃\n" +
"╰━━━━━━━━━━━━━━━━⬣"
            );
        }

        // parse: text | mood   OR   text | lang   OR  text | lang | mood
        let text = input;
        let lang = "En";
        let mood = "NORMAL";

        if (input.indexOf("|") !== -1) {
            const parts = input.split("|").map(function (s) {
                return s.trim();
            });
            text = parts[0] || text;
            if (parts[1]) {
                const p1 = parts[1].toUpperCase();
                // if short → language, else mood
                if (parts[1].length <= 5 && !/EXCITED|SAD|ANGRY|NORMAL|HAPPY/i.test(parts[1])) {
                    lang = parts[1];
                } else {
                    mood = p1;
                }
            }
            if (parts[2]) {
                mood = parts[2].toUpperCase();
            }
        }

        if (!text) return reply("❌ Provide text to speak.");

        try {
            await reply("🗣️ Generating voice...");

            const api =
                "https://api.omegatech.app/api/ai/clideo?action=generate&text=" +
                encodeURIComponent(text) +
                "&lang=" +
                encodeURIComponent(lang) +
                "&mood=" +
                encodeURIComponent(mood);

            const { data } = await axios.get(api, {
                timeout: 60000,
                headers: { "User-Agent": "VENOM-X" }
            });

            if (!data || data.success === false) {
                throw new Error(
                    (data && (data.error || data.message)) || "TTS API failed"
                );
            }

            const d = data.data || data;
            const audioUrl = d.previewUrl || d.url || d.audio || d.link;
            if (!audioUrl) throw new Error("No audio URL returned");

            const voice = d.voice || "default";
            const usedLang = d.languageCode || lang;
            const usedMood = d.mood || mood;

            // download then send (more reliable than url stream on WA)
            const bin = await axios.get(audioUrl, {
                responseType: "arraybuffer",
                timeout: 60000,
                headers: { "User-Agent": "VENOM-X" }
            });
            const buffer = Buffer.from(bin.data);
            if (!buffer.length) throw new Error("Empty audio file");

            await sock.sendMessage(
                from,
                {
                    audio: buffer,
                    mimetype: "audio/mpeg",
                    ptt: true,
                    fileName: "venom-tts.mp3"
                },
                { quoted: message }
            );

            await reply(
"╭━━〔 🗣️ TTS READY 〕━━⬣\n" +
"┃ 🎤 " + voice + "\n" +
"┃ 🌍 " + usedLang + "\n" +
"┃ 😄 " + usedMood + "\n" +
"╰━━━━━━━━━━━━━━━━⬣"
            );
        } catch (e) {
            console.log("TTS ERROR:", e.message || e);
            return reply(
"╭━━〔 ❌ TTS FAILED 〕━━⬣\n" +
"┃\n" +
"┃ " + String(e.message || e).slice(0, 220) + "\n" +
"┃\n" +
"╰━━━━━━━━━━━━━━━━⬣"
            );
        }
    }
};
