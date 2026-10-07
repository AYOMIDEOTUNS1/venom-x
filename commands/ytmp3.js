const axios = require("axios");

function pickUrl(text) {
    const m = String(text || "").match(/(https?:\/\/[^\s]+)/i);
    return m ? m[0] : "";
}

module.exports = {
    name: "ytmp3",
    aliases: ["yta", "ytmusic"],

    run: async function ({ sock, from, args, reply, message }) {
        const url = pickUrl((args || []).join(" "));
        if (!url || !/youtube\.com|youtu\.be/i.test(url)) {
            return reply("🎵 Usage: #ytmp3 <youtube url>");
        }

        try {
            await reply("⏳ Fetching audio...");
            const api =
                "https://api.siputzx.my.id/api/d/ytmp3?url=" +
                encodeURIComponent(url);
            const { data } = await axios.get(api, { timeout: 60000 });
            const d = data.data || data.result || data;
            const link = d.dl || d.download || d.url || d.audio;
            const title = d.title || "YouTube Audio";

            if (!link) throw new Error("No audio link returned");

            const bin = await axios.get(link, {
                responseType: "arraybuffer",
                timeout: 120000,
                maxContentLength: 30 * 1024 * 1024
            });
            const buffer = Buffer.from(bin.data);
            if (buffer.length < 1000) throw new Error("Empty audio");

            await sock.sendMessage(
                from,
                {
                    audio: buffer,
                    mimetype: "audio/mpeg",
                    fileName: String(title).slice(0, 40) + ".mp3",
                    ptt: false
                },
                { quoted: message }
            );
        } catch (e) {
            return reply("❌ ytmp3 failed: " + String(e.message || e).slice(0, 180));
        }
    }
};
