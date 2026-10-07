const axios = require("axios");

function pickUrl(text) {
    const m = String(text || "").match(/(https?:\/\/[^\s]+)/i);
    return m ? m[0] : "";
}

module.exports = {
    name: "ytmp4",
    aliases: ["ytv", "ytvideo"],

    run: async function ({ sock, from, args, reply, message }) {
        const url = pickUrl((args || []).join(" "));
        if (!url || !/youtube\.com|youtu\.be/i.test(url)) {
            return reply("🎬 Usage: #ytmp4 <youtube url>");
        }

        try {
            await reply("⏳ Fetching video...");
            const api =
                "https://api.siputzx.my.id/api/d/ytmp4?url=" +
                encodeURIComponent(url);
            const { data } = await axios.get(api, { timeout: 60000 });
            const d = data.data || data.result || data;
            const link = d.dl || d.download || d.url || d.video;
            const title = d.title || "YouTube Video";

            if (!link) throw new Error("No video link returned");

            const bin = await axios.get(link, {
                responseType: "arraybuffer",
                timeout: 180000,
                maxContentLength: 60 * 1024 * 1024
            });
            const buffer = Buffer.from(bin.data);
            if (buffer.length < 1000) throw new Error("Empty video");

            await sock.sendMessage(
                from,
                {
                    video: buffer,
                    mimetype: "video/mp4",
                    caption: "🎬 *" + String(title).slice(0, 80) + "*\n⚡ VENOM X",
                    fileName: "venom-yt.mp4"
                },
                { quoted: message }
            );
        } catch (e) {
            return reply("❌ ytmp4 failed: " + String(e.message || e).slice(0, 180));
        }
    }
};
