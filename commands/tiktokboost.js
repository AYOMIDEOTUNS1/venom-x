/**
 * 🎯 TikTok Booster
 * Boost TikTok video views & likes
 * 
 * Commands:
 * #tiktokboost <url>
 * #ttboost <url>
 * #boosttiktok <url>
 */

const axios = require('axios');

module.exports = {
    name: "tiktokboost",
    aliases: ["ttboost", "boosttiktok", "ttbooster"],
    category: "tools",
    description: "Boost TikTok video views and likes",

    run: async ({ sock, from, args, reply, message }) => {

        const text = args.join(' ').trim();

        if (!text) {
            return reply(`╭━━━『 *TIKTOK BOOSTER* 』━━━
│
│  Usage:
│  ▸ #tiktokboost <TikTok URL>
│
│  Example:
│  ▸ #tiktokboost https://www.tiktok.com/@user/video/123456789
│
╰━━━━━━━━━━━━━━━━━━━━
⚠️ Note: Views & likes take time to appear`);
        }

        const urlMatch = text.match(/(https?:\/\/[^\s]+)/i);
        if (!urlMatch) {
            return reply('❌ Please provide a valid TikTok video link.');
        }

        const tiktokUrl = urlMatch[0];

        if (!tiktokUrl.includes('tiktok.com')) {
            return reply('❌ Invalid TikTok URL.');
        }

        await reply(`🔄 *Processing...*\n\n📱 Boosting:\n${tiktokUrl}`);

        try {
            const apiUrl = `https://omegatech-api.dixonomega.tech/api/Fun/Tiktok-booster?action=boost&url=${encodeURIComponent(tiktokUrl)}`;

            const response = await axios.get(apiUrl, {
                timeout: 30000
            });

            if (!response.data?.success) {
                throw new Error(response.data?.message || 'API request failed');
            }

            const data = response.data.data || {};
            const timestamp = response.data.timestamp 
                ? new Date(response.data.timestamp).toLocaleString() 
                : new Date().toLocaleString();

            const caption = `🎯 *TIKTOK BOOSTER SUCCESS*

━━━━━━━━━━━━━━━━━━━━
📹 *Title:* ${data.title || 'Not available'}
👤 *Author:* ${data.author || 'Unknown'}
🔗 *Username:* @${data.username || 'Unknown'}
📊 *Status:* ${data.status || 'Processing'}
━━━━━━━━━━━━━━━━━━━━

📝 *Note:* Likes and views take time to register.

🕐 *Time:* ${timestamp}
🔹 *Source:* ${response.data.source || 'Omegatech'}`;

            return reply(caption);

        } catch (error) {
            console.error('[TIKTOK BOOST]', error.response?.data || error.message);

            let errorMsg = '❌ *Failed to boost TikTok video*\n\n';

            if (error.response) {
                errorMsg += `📌 Status: ${error.response.status}\n`;
                errorMsg += `📌 Error: ${error.response.data?.message || 'Unknown error'}`;
            } else if (error.request) {
                errorMsg += `📌 No response from server. Try again later.`;
            } else {
                errorMsg += `📌 Error: ${error.message}`;
            }

            return reply(errorMsg);
        }
    }
};
