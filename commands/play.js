/**
 * 🎵 Apple Music Search & Download (Upgraded)
 * Commands: #play / #apple
 * 
 * Features:
 * - Search results with cover
 * - High quality audio download
 * - Nice captions
 */

const axios = require('axios');

const searchCache = new Map();

module.exports = {
    name: "play",
    aliases: ["apple", "applemusic", "song"],
    category: "downloader",
    description: "Search and download music from Apple Music",

    run: async ({ sock, from, args, reply, sender, message }) => {

        const text = args.join(' ').trim();

        if (!text) {
            return reply(`🎵 *Apple Music Player*\n\n` +
                `Usage:\n` +
                `• #play <song name>\n` +
                `• #play <song name> <number>\n\n` +
                `Example:\n` +
                `#play Alone\n` +
                `#play Alone 2`);
        }

        const parts = text.split(' ');
        const lastPart = parts[parts.length - 1];
        const isNumber = /^\d+$/.test(lastPart);

        if (isNumber) {
            const query = parts.slice(0, -1).join(' ');
            const num = parseInt(lastPart);
            return await downloadSong(sock, from, sender, message, reply, query, num);
        }

        // ========== SEARCH ==========
        await reply(`🔍 Searching Apple Music for: *${text}*...`);

        try {
            const searchUrl = `https://api.omegatech.app/api/Search/Applemusic?action=search&query=${encodeURIComponent(text)}`;
            const { data: searchData } = await axios.get(searchUrl, { timeout: 30000 });

            if (!searchData.success || !searchData.data?.results?.length) {
                return reply(`❌ No results found for *${text}* on Apple Music.`);
            }

            const results = searchData.data.results.slice(0, 8);

            // Save to cache (5 minutes)
            searchCache.set(sender, {
                results,
                query: text,
                timestamp: Date.now()
            });

            let listText = `🎵 *Apple Music Results*\n\n`;
            listText += `🔍 Query: *${text}*\n`;
            listText += `📌 Found: *${results.length}* songs\n\n`;

            results.forEach((song, i) => {
                const explicit = song.explicit ? '🔞' : '✅';
                listText += `*${i + 1}.* ${song.title}\n`;
                listText += `    👤 ${song.artist} ${explicit}\n\n`;
            });

            listText += `📥 *To download:*\n`;
            listText += `Type: #play ${text} <number>\n`;
            listText += `Example: #play ${text} 1`;

            // Send with cover image of first result
            if (results[0]?.cover) {
                try {
                    await sock.sendMessage(from, {
                        image: { url: results[0].cover },
                        caption: listText
                    }, { quoted: message });
                    return;
                } catch (e) {
                    // fallback to text only
                }
            }

            return reply(listText);

        } catch (error) {
            console.error('[APPLE SEARCH]', error.message);
            return reply('❌ Error searching Apple Music. Please try again later.');
        }
    }
};

// ========== DOWNLOAD FUNCTION ==========
async function downloadSong(sock, from, sender, message, reply, query, num) {

    const cached = searchCache.get(sender);

    if (!cached || Date.now() - cached.timestamp > 5 * 60 * 1000) {
        searchCache.delete(sender);
        return reply('⏰ Search results expired. Please search again with #play <song>');
    }

    const results = cached.results;
    const selected = results[num - 1];

    if (!selected) {
        return reply(`❌ Song number *${num}* not found.\nPlease choose between 1 - ${results.length}`);
    }

    await reply(`⬇️ *Downloading...*\n\n🎵 *${selected.title}*\n👤 ${selected.artist}\n\nPlease wait...`);

    try {
        const downloadUrl = `https://api.omegatech.app/api/Search/Applemusic?action=download&query=\( {encodeURIComponent(cached.query)}&url= \){encodeURIComponent(selected.url)}`;
        
        const { data: downloadData } = await axios.get(downloadUrl, { timeout: 60000 });

        if (!downloadData.success || !downloadData.data?.downloadUrl) {
            throw new Error('Failed to get download link');
        }

        const audioUrl = downloadData.data.downloadUrl;
        const title = downloadData.data.title || selected.title;
        const artist = downloadData.data.artist || selected.artist;
        const cover = selected.cover || null;

        // Send audio with nice caption + cover as thumbnail if possible
        await sock.sendMessage(from, {
            audio: { url: audioUrl },
            mimetype: 'audio/mpeg',
            fileName: `${title}.mp3`,
            caption: `✅ *Download Complete*\n\n🎵 *${title}*\n👤 ${artist}\n\n🔹 Powered by Apple Music`,
            contextInfo: cover ? {
                externalAdReply: {
                    title: title,
                    body: artist,
                    mediaType: 1,
                    thumbnailUrl: cover,
                    sourceUrl: selected.url || 'https://music.apple.com',
                    renderLargerThumbnail: true
                }
            } : undefined
        }, { quoted: message });

        searchCache.delete(sender);

    } catch (error) {
        console.error('[APPLE DOWNLOAD]', error.message);
        return reply('❌ Failed to download the song. Please try again.');
    }
}
