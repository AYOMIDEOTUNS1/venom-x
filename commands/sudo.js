/**
 * 🔥 VENOM X - SUDO MANAGER
 * Add / Remove / List Sudo users
 * Only Owner can use this command
 */

const fs = require('fs');
const path = require('path');

const SUDO_PATH = path.join(__dirname, '../data/sudo.json');

// Load sudo list
function loadSudo() {
    try {
        if (!fs.existsSync(SUDO_PATH)) {
            fs.writeFileSync(SUDO_PATH, JSON.stringify([], null, 2));
            return [];
        }
        return JSON.parse(fs.readFileSync(SUDO_PATH, 'utf8'));
    } catch {
        return [];
    }
}

// Save sudo list
function saveSudo(list) {
    try {
        const dir = path.dirname(SUDO_PATH);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(SUDO_PATH, JSON.stringify(list, null, 2));
    } catch (e) {
        console.error('[SUDO] Failed to save:', e.message);
    }
}

// Normalize number (remove @s.whatsapp.net, spaces, + etc)
function cleanNumber(num) {
    return String(num).replace(/\D/g, '');
}

module.exports = {
    name: "sudo",
    aliases: ["addsudo", "delsudo", "listsudo"],
    category: "owner",
    description: "Manage sudo users",

    run: async ({ sock, from, args, reply, isOwner, sender, message }) => {

        // Only real Owner can manage sudo
        if (!isOwner) {
            return reply('🚫 *Only the Bot Owner can use this command.*');
        }

        const action = (args[0] || '').toLowerCase();
        let sudoList = loadSudo();

        // ========== HELP ==========
        if (!action || action === 'help') {
            return reply(`╭━━━『 *SUDO MANAGER* 』━━━
│
│  *Add Sudo*
│  ▸ #sudo add @user
│  ▸ #sudo add 234xxxxxxxxxx
│
│  *Remove Sudo*
│  ▸ #sudo del @user
│  ▸ #sudo del 234xxxxxxxxxx
│
│  *List Sudo*
│  ▸ #sudo list
│
╰━━━━━━━━━━━━━━━━━━━
Only *Owner* can manage sudo users.`);
        }

        // ========== LIST ==========
        if (action === 'list' || action === 'ls') {
            if (sudoList.length === 0) {
                return reply('📭 *No sudo users yet.*');
            }

            const listText = sudoList.map((num, i) => `│  \( {i + 1}. wa.me/ \){num}`).join('\n');
            return reply(`╭━━━『 👑 *SUDO LIST* 』━━━
│  Total: *${sudoList.length}*
│
${listText}
│
╰━━━━━━━━━━━━━━━━━━━`);
        }

        // ========== ADD ==========
        if (action === 'add') {
            let target = args[1];

            // If replied to someone
            if (!target && message.message?.extendedTextMessage?.contextInfo?.participant) {
                target = message.message.extendedTextMessage.contextInfo.participant;
            }

            // If mentioned
            if (!target && message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]) {
                target = message.message.extendedTextMessage.contextInfo.mentionedJid[0];
            }

            if (!target) {
                return reply('❌ Tag a user or type the number.\nExample: `#sudo add @user` or `#sudo add 234xxx`');
            }

            const number = cleanNumber(target);

            if (number.length < 8) {
                return reply('❌ Invalid number.');
            }

            if (sudoList.includes(number)) {
                return reply(`⚠️ @${number} is already a *Sudo* user.`, { mentions: [number + '@s.whatsapp.net'] });
            }

            sudoList.push(number);
            saveSudo(sudoList);

            return reply(`✅ Successfully added *${number}* as Sudo!`, {
                mentions: [number + '@s.whatsapp.net']
            });
        }

        // ========== DELETE ==========
        if (action === 'del' || action === 'delete' || action === 'remove' || action === 'rm') {
            let target = args[1];

            if (!target && message.message?.extendedTextMessage?.contextInfo?.participant) {
                target = message.message.extendedTextMessage.contextInfo.participant;
            }

            if (!target && message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]) {
                target = message.message.extendedTextMessage.contextInfo.mentionedJid[0];
            }

            if (!target) {
                return reply('❌ Tag a user or type the number.\nExample: `#sudo del @user`');
            }

            const number = cleanNumber(target);

            if (!sudoList.includes(number)) {
                return reply(`⚠️ ${number} is not in the Sudo list.`);
            }

            sudoList = sudoList.filter(n => n !== number);
            saveSudo(sudoList);

            return reply(`✅ Successfully removed *${number}* from Sudo.`);
        }

        return reply('❌ Invalid action.\nUse: `#sudo add`, `#sudo del`, or `#sudo list`');
    }
};
