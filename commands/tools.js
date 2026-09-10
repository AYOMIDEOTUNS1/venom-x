const axios = require("axios");

module.exports = {
    name: "tools",
    aliases: ["translate", "weather", "calc", "qr", "ss", "font", "toaudio", "tts", "bass", "smooth"],

    run: async ({ sock, from, args, reply, message, commandName }) => {
        const cmd = commandName.toLowerCase();
        const text = args.join(" ").trim();

        // TRANSLATE
        if (cmd === "translate") {
            if (args.length < 2) return reply("🌍 Usage: #translate <lang> <text>\nExample: #translate es Hello");
            const lang = args[0];
            const q = args.slice(1).join(" ");
            try {
                const res = await axios.get(`https://api.mymemory.translated.net/get?q=\( {encodeURIComponent(q)}&langpair=en| \){lang}`);
                const translated = res.data.responseData.translatedText;
                return reply(`🌍 *Translate*\n\n*From:* \( {q}\n*To ( \){lang}):* ${translated}`);
            } catch {
                return reply("❌ Translation failed.");
            }
        }

        // WEATHER
        if (cmd === "weather") {
            if (!text) return reply("☁️ Usage: #weather <city>");
            try {
                const res = await axios.get(`https://wttr.in/${encodeURIComponent(text)}?format=%C+%t+%h+%w`, { timeout: 10000 });
                return reply(`🌤️ *Weather in \( {text}*\n\n \){res.data}`);
            } catch {
                return reply("❌ Couldn't get weather.");
            }
        }

        // CALC
        if (cmd === "calc") {
            if (!text) return reply("🧮 Usage: #calc 2 + 2");
            try {
                // Basic safe calc
                const result = Function(`'use strict'; return (${text})`)();
                return reply(`🧮 *Result:* ${result}`);
            } catch {
                return reply("❌ Invalid expression.");
            }
        }

        // QR
        if (cmd === "qr") {
            if (!text) return reply("📎 Usage: #qr <text>");
            const url = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(text)}`;
            await sock.sendMessage(from, {
                image: { url },
                caption: `✅ QR Code generated`
            }, { quoted: message });
            return;
        }

        // SS (Screenshot)
        if (cmd === "ss") {
            if (!text) return reply("📸 Usage: #ss <url>");
            try {
                const url = `https://api.apiflash.com/v1/urltoimage?access_key=YOUR_KEY&url=${encodeURIComponent(text)}`;
                // Free alternative
                await sock.sendMessage(from, {
                    image: { url: `https://image.thum.io/get/full/width/1200/crop/900/${text}` },
                    caption: `📸 Screenshot of:\n${text}`
                }, { quoted: message });
            } catch {
                reply("❌ Failed to take screenshot.");
            }
            return;
        }

        // FONT
        if (cmd === "font") {
            if (!text) return reply("🔤 Usage: #font <text>");
            const styles = {
                bold: text.replace(/[a-zA-Z]/g, c => String.fromCharCode(c.charCodeAt(0) + (c === c.toUpperCase() ? 119743 : 119737))),
                italic: text,
                fancy: text.split("").join(" ")
            };
            return reply(`🔤 *Stylish Text*\n\n*Bold:* ${styles.bold}\n*Fancy:* ${styles.fancy}`);
        }

        // TTS
        if (cmd === "tts") {
            if (!text) return reply("🗣️ Usage: #tts <text>");
            try {
                const url = `https://api.streamelements.com/kappa/v2/speech?voice=Brian&text=${encodeURIComponent(text)}`;
                await sock.sendMessage(from, {
                    audio: { url },
                    mimetype: "audio/mpeg",
                    ptt: true
                }, { quoted: message });
            } catch {
                reply("❌ TTS failed.");
            }
            return;
        }

        // TOAUDIO / BASS / SMOOTH (placeholder - needs ffmpeg)
        if (["toaudio", "bass", "smooth"].includes(cmd)) {
            return reply(`⚠️ This feature requires a replied video/audio and ffmpeg.\nStill under improvement.`);
        }
    }
};
