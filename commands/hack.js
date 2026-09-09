/**
 * 🎭 Fake Hack Command (Fun Only)
 * Works in Groups + DM
 */

module.exports = {
    name: "hack",
    aliases: ["hacking", "hackuser"],
    category: "fun",
    description: "Fake hack someone (just for fun)",

    run: async ({ sock, from, args, reply, message, sender, isGroup }) => {

        let target = null;

        // Mentioned
        if (message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]) {
            target = message.message.extendedTextMessage.contextInfo.mentionedJid[0];
        }

        // Replied to someone
        if (!target && message.message?.extendedTextMessage?.contextInfo?.participant) {
            target = message.message.extendedTextMessage.contextInfo.participant;
        }

        // Number typed
        if (!target && args[0]) {
            let number = args[0].replace(/[^0-9]/g, "");
            if (number.length >= 8) {
                target = number + "@s.whatsapp.net";
            }
        }

        // In DM → target the other person
        if (!target && !isGroup) {
            target = from;
        }

        if (!target) {
            return reply(`╭━━〔 🎭 HACK 〕━━⬣
┃
┃ Usage:
┃ • #hack @user
┃ • #hack 234xxxxxxxxxx
┃ • Reply to someone + #hack
┃
╰━━━━━━━━━━━━━━━━⬣`);
        }

        const number = String(target).replace(/\D/g, "").slice(-12) || "Unknown";
        const mention = target.includes("@") ? target : target + "@s.whatsapp.net";

        const steps = [
            `💻 *Initializing hack on @${number}...*`,
            `🔍 Scanning device...`,
            `📡 Connecting to server...`,
            `📂 Accessing file system...`,
            `🔑 Bypassing security...`,
            `📊 Extracting data...`,
            `🕵️ Reading messages...`,
            `📸 Accessing gallery...`,
            `📍 Tracking location...`,
            `💾 Downloading files...`
        ];

        let sentMsg = await sock.sendMessage(from, {
            text: steps[0],
            mentions: [mention]
        }, { quoted: message });

        for (let i = 1; i < steps.length; i++) {
            await new Promise(r => setTimeout(r, 1600));
            try {
                await sock.sendMessage(from, {
                    text: steps[i],
                    edit: sentMsg.key,
                    mentions: [mention]
                });
            } catch {}
        }

        await new Promise(r => setTimeout(r, 1800));

        const results = [
`✅ *Hack Successful!*

👤 Target: @${number}
📱 Device: Android
🔋 Battery: ${Math.floor(Math.random() * 40) + 55}%
📶 Network: WiFi
📍 Location: Nearby`,

`✅ *Hack Complete!*

👤 Target: @${number}
📂 Files Found: ${Math.floor(Math.random() * 800) + 120}
📸 Photos: ${Math.floor(Math.random() * 400) + 40}
💬 Messages: ${Math.floor(Math.random() * 1500) + 300}`,

`✅ *Access Granted!*

👤 Target: @${number}
🔓 Security: Bypassed
📧 Emails: Accessed
☁️ Cloud: Accessed`
        ];

        const finalText = results[Math.floor(Math.random() * results.length)];

        try {
            await sock.sendMessage(from, {
                text: finalText,
                edit: sentMsg.key,
                mentions: [mention]
            });
        } catch {
            await sock.sendMessage(from, {
                text: finalText,
                mentions: [mention]
            }, { quoted: message });
        }
    }
};
