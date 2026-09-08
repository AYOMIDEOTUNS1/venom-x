/**
 * 🍌 Nano-Banana AI Multi-Engine
 * Text-to-Image | Image Editing | Multi-Image Blending
 * 
 * Commands:
 * #nano <prompt>               → Generate image
 * #nano (reply image) <prompt> → Edit image
 * #nanopro                     → Start collector mode
 * #nanopro done <prompt>       → Blend collected images
 */

const axios = require('axios');
const FormData = require('form-data');

const bananaSession = {};

async function uploadMedia(message, sock) {
    try {
        const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage ||
                       message.message?.imageMessage;

        let mediaMessage = null;
        let type = null;

        if (quoted?.imageMessage) {
            mediaMessage = quoted.imageMessage;
            type = 'image';
        } else if (message.message?.imageMessage) {
            mediaMessage = message.message.imageMessage;
            type = 'image';
        }

        if (!mediaMessage) return null;

        const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
        const stream = await downloadContentFromMessage(mediaMessage, type);
        const chunks = [];
        for await (const chunk of stream) chunks.push(chunk);
        const buffer = Buffer.concat(chunks);

        const form = new FormData();
        form.append('file', buffer, { filename: 'image.jpg' });
        form.append('type', 'permanent');

        const res = await axios.post('https://tmp.malvryx.dev/upload', form, {
            headers: form.getHeaders(),
            timeout: 30000
        });

        return res.data?.cdnUrl || res.data?.directUrl || null;
    } catch (e) {
        console.error('[NANO Upload]', e.message);
        return null;
    }
}

module.exports = {
    name: "nano",
    aliases: ["nanopro", "banana", "nanobana"],
    category: "ai",
    description: "AI Image Generation & Editing",

    run: async ({ sock, from, message, args, reply, sender }) => {

        const command = (message.body || '').split(' ')[0].replace(/^[.#/!]/, '').toLowerCase();
        const text = args.join(' ').trim();
        const userId = sender;
        const isNanoPro = command === 'nanopro';

        // ==================== NANOPRO (Collector Mode) ====================
        if (isNanoPro) {
            if (!bananaSession[userId]) bananaSession[userId] = { images: [] };

            // Finish & Blend
            if (text.toLowerCase().startsWith('done')) {
                const session = bananaSession[userId];
                const finalPrompt = text.replace(/done/i, '').trim();

                if (session.images.length < 2) {
                    return reply('⚠️ *Nano-Banana Pro*\n\nPlease add at least *2 images* before finishing.');
                }
                if (!finalPrompt) {
                    return reply(`⚠️ *Prompt Required*\n\nUsage:\n#nanopro done <your prompt>`);
                }

                await reply('🎨 Blending images... please wait.');

                try {
                    let apiUrl = `https://omegatech-api.dixonomega.tech/api/ai/nanobana-pro-v3?prompt=${encodeURIComponent(finalPrompt)}`;
                    session.images.forEach((url, i) => {
                        apiUrl += `&image\( {i + 1}= \){encodeURIComponent(url)}`;
                    });

                    const { data: initRes } = await axios.get(apiUrl, { timeout: 30000 });
                    if (!initRes.success) throw new Error('API failed to start blending.');

                    const taskId = initRes.task_id;
                    let resultUrl = null;

                    for (let i = 0; i < 25; i++) {
                        await new Promise(r => setTimeout(r, 5000));
                        const { data: check } = await axios.get(
                            `https://omegatech-api.dixonomega.tech/api/ai/nano-banana2-result?task_id=${taskId}`,
                            { timeout: 15000 }
                        );

                        if (check.status === 'completed' && check.image_url) {
                            resultUrl = check.image_url;
                            break;
                        }
                        if (check.status === 'failed') throw new Error('Generation failed on server.');
                    }

                    if (!resultUrl) throw new Error('Generation timed out.');

                    await sock.sendMessage(from, {
                        image: { url: resultUrl },
                        caption: `🍌 *NANO-BANANA PRO*\n\n🖼️ Images Blended: *${session.images.length}*\n📝 Prompt: ${finalPrompt}`
                    }, { quoted: message });

                    delete bananaSession[userId];

                } catch (e) {
                    console.error('[NANOPRO]', e.message);
                    reply(`❌ *Error:* ${e.message}`);
                    delete bananaSession[userId];
                }
                return;
            }

            // Add image to collector
            const link = await uploadMedia(message, sock);
            if (!link) {
                return reply(`📸 *Collector Mode*\n\nReply to an image with *#nanopro* to add it.\n\nWhen ready:\n*#nanopro done <prompt>*`);
            }

            if (bananaSession[userId].images.length >= 4) {
                return reply('❌ Maximum of *4 images* allowed.');
            }

            bananaSession[userId].images.push(link);
            return reply(`✅ *Image ${bananaSession[userId].images.length}/4 Added*\n\nSend more or type:\n*#nanopro done <prompt>*`);
        }

        // ==================== NANO (Normal Mode) ====================
        const imageUrl = await uploadMedia(message, sock);

        // Image Editing
        if (imageUrl) {
            if (!text) {
                return reply(`⚠️ *Prompt Required*\n\nReply to an image with:\n#nano make it cyberpunk`);
            }

            await reply('🎨 Editing image... please wait.');

            try {
                const { data: init } = await axios.get(
                    `https://omegatech-api.dixonomega.tech/api/ai/nano-banana2?prompt=\( {encodeURIComponent(text)}&image= \){encodeURIComponent(imageUrl)}`,
                    { timeout: 30000 }
                );

                let resultUrl = null;
                for (let i = 0; i < 20; i++) {
                    await new Promise(r => setTimeout(r, 5000));
                    const { data: check } = await axios.get(
                        `https://omegatech-api.dixonomega.tech/api/ai/nano-banana2-result?task_id=${init.task_id}`,
                        { timeout: 15000 }
                    );
                    if (check.status === 'completed' && check.image_url) {
                        resultUrl = check.image_url;
                        break;
                    }
                }

                if (resultUrl) {
                    await sock.sendMessage(from, {
                        image: { url: resultUrl },
                        caption: `✨ *NANO EDIT*\n\n📝 Prompt: ${text}`
                    }, { quoted: message });
                } else {
                    reply('❌ Image edit timed out.');
                }
            } catch (e) {
                console.error('[NANO EDIT]', e.message);
                reply('❌ Image edit failed.');
            }
            return;
        }

        // Text to Image
        if (!text) {
            return reply(`⚠️ *Prompt Required*\n\nUsage:\n#nano a cute cat wearing sunglasses`);
        }

        await reply('🍌 Generating image... please wait.');

        try {
            const { data } = await axios.get(
                `https://omegatech-api.dixonomega.tech/api/ai/nano-banana-pro?prompt=${encodeURIComponent(text)}`,
                { timeout: 60000 }
            );

            if (data.image) {
                await sock.sendMessage(from, {
                    image: { url: data.image },
                    caption: `🍌 *NANO GENERATION*\n\n📝 Prompt: ${text}`
                }, { quoted: message });
            } else {
                reply('❌ No image was generated.');
            }
        } catch (e) {
            console.error('[NANO GEN]', e.message);
            reply('❌ Generation failed. Try again later.');
        }
    }
};
