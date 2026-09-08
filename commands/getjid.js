/**
 * 🔍 Get Channel JID Plugin
 * Credits: SILENT TECH (cleaned & improved)
 */

module.exports = {
    name: "getjid",
    aliases: ["channeljid", "cjid", "getchannel"],
    category: "tools",
    description: "Get JID, name and subscriber count of a WhatsApp Channel",

    run: async ({ sock, args, reply }) => {
        const link = args[0];

        if (!link) {
            return reply(`╭━━━『 *GET CHANNEL JID* 』━━━
│
│  Usage:
│  ▸ #getjid <channel link>
│
│
╰━━━━━━━━━━━━━━━━━━━━`);
        }

        if (!link.includes('whatsapp.com/channel')) {
            return reply('❌ Please provide a valid WhatsApp Channel link.');
        }

        try {
            const inviteCode = link.split('/').pop().split('?')[0];
            const meta = await sock.newsletterMetadata("invite", inviteCode);

            if (!meta || !meta.id) {
                return reply('❌ Failed to fetch channel info. Link may be invalid.');
            }

            const caption = `╭━━━『 📢 *CHANNEL INFO* 』━━━
│
│  *Name:* ${meta.name || 'Unknown'}
│  *JID:* \`${meta.id}\`
│  *Subscribers:* ${meta.subscribers?.toLocaleString() || 'N/A'}
│  *Description:* ${meta.description || 'No description'}
│
╰━━━━━━━━━━━━━━━━━━━━`;

            await reply(caption);

        } catch (error) {
            console.error('[GETJID] Error:', error);
            return reply('❌ Invalid channel link or failed to fetch data.');
        }
    }
};
