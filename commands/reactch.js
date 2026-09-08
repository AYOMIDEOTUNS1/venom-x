/**
 * ⚡ WhatsApp Channel Reactor
 * React to WhatsApp Channel posts with multiple emojis
 * 
 * Original: Omegatech
 * Cleaned & converted for VENOM X
 */

const axios = require('axios');

class ReactChannel {
    constructor(config) {
        this.userJwt = config.userJwt;
        this.siteKey = '6LemKk8sAAAAAH5PB3f1EspbMlXjtwv5C8tiMHSm';
        this.backendUrl = 'https://back.asitha.top/api';

        this.http = axios.create({
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${this.userJwt}`
            },
            timeout: 30000
        });
    }

    async getRecaptchaToken() {
        const { data } = await axios.get(
            'https://omegatech-api.dixonomega.tech/api/tools/recaptcha-v3',
            {
                params: {
                    sitekey: this.siteKey,
                    url: 'https://back.asitha.top/api',
                    use_enterprise: 'false'
                }
            }
        );

        if (!data?.success || !data?.token) {
            throw new Error('Recaptcha bypass failed: ' + (data?.message || 'No token returned'));
        }

        return data.token;
    }

    async getTempApiKey(token) {
        const { data } = await this.http.post(
            `${this.backendUrl}/user/get-temp-token`,
            { recaptcha_token: token }
        );

        if (!data?.token) throw new Error('Temp API key failed');
        return data.token;
    }

    async reactToPost(postLink, reacts) {
        const recaptcha = await this.getRecaptchaToken();
        const tempKey = await this.getTempApiKey(recaptcha);

        const { data } = await this.http.post(
            `\( {this.backendUrl}/channel/react-to-post?apiKey= \){tempKey}`,
            {
                post_link: postLink,
                reacts
            }
        );

        return data;
    }
}

module.exports = {
    name: "reactch",
    aliases: ["rch", "channelreact", "reactchannel"],
    category: "tools",
    description: "React to WhatsApp Channel posts",

    run: async ({ sock, args, reply, message }) => {

        if (!args[0]) {
            return reply(`╭━━━『 *CHANNEL REACTOR* 』━━━
│
│  Usage:
│  ▸ #reactch <channel post link> <emoji1,emoji2>
│
│  Example:
│  ▸ #reactch https://whatsapp.com/channel/xxx/yyyy 🔥,😭,❤️
│
│  Max 4 emojis
│
╰━━━━━━━━━━━━━━━━━━━━`);
        }

        try {
            await sock.sendMessage(message.key.remoteJid, {
                react: { text: '⏳', key: message.key }
            });

            const input = args.join(' ');
            const parts = input.split(' ');
            const postLink = parts[0];
            const reactsRaw = parts.slice(1).join(' ');

            if (!postLink || !reactsRaw) {
                return reply('❌ Invalid format.\nUse: #reactch <link> <emoji1,emoji2>');
            }

            if (!postLink.includes('whatsapp.com/channel/')) {
                return reply('❌ Invalid WhatsApp Channel link.');
            }

            const emojis = reactsRaw
                .split(',')
                .map(e => e.trim())
                .filter(Boolean);

            if (!emojis.length) {
                return reply('❌ No emojis provided.');
            }

            if (emojis.length > 4) {
                return reply('❌ Maximum 4 emojis allowed.');
            }

            // ⚠️ Put your JWT token here
            const client = new ReactChannel({
                userJwt: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY5OGE2ZGI5MjVjMzUyOTcxZTIyYTdkNSIsImlhdCI6MTc3NTg1NzUyMCwiZXhwIjoxNzc2NDYyMzIwfQ.q7D6potY6cl3n-ZY8nQbetNFqPSl79aF5IIZ_QbtABc'
            });

            await client.reactToPost(postLink, emojis.join(','));

            await sock.sendMessage(message.key.remoteJid, {
                react: { text: '✅', key: message.key }
            });

            return reply(`✅ *Reactions sent successfully!*\n\nEmojis: ${emojis.join(' ')}`);

        } catch (e) {
            console.error('[REACTCH] Error:', e.response?.data || e.message);

            await sock.sendMessage(message.key.remoteJid, {
                react: { text: '❌', key: message.key }
            });

            return reply(`❌ Failed: ${e.response?.data?.message || e.message}`);
        }
    }
};
