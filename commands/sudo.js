/**
 * 🔥 VENOM X - SUDO MANAGER (FIXED)
 */

const fs = require('fs');
const path = require('path');

const SUDO_PATH = path.join(__dirname, '../data/sudo.json');

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

function saveSudo(list) {
    try {
        const dir = path.dirname(SUDO_PATH);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(SUDO_PATH, JSON.stringify(list, null, 2));
    } catch (e) {
        console.error('[SUDO] Save error:', e.message);
    }
}

function cleanNumber(num) {
    return String(num).replace(/\D/g, '');
}

module.exports = {
    name: "sudo",
    aliases: ["addsudo", "delsudo", "listsudo"],
    category: "owner",

    run: async ({ sock, args, reply, isOwner, message }) => {

        if (!isOwner) {
            return reply('🚫 *Only the Bot Owner can use this command.*');
        }

        const action = (args[0] || '').toLowerCase();
        let sudoList = loadSudo();

        // HELP
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
╰━━━━━━━━━━━━━━━━━━━`);
        }

        // LIST
        if (action === 'list' || action === 'ls') {
            if (sudoList.length === 0) {
                return reply('📭 *No sudo users yet.*');
            }

            let listText = '';
            sudoList.forEach((num, i) => {
                listText += `│  \( {i + 1}. wa.me/ \){num}\n`;
            });

            return reply(`╭━━━『 👑 *SUDO LIST* 』━━━
│  Total: *${sudoList.length}*
│
${listText}│
╰━━━━━━━━━━━━━━━━━━━`);
        }

        // ADD
        if (action === 'add') {
            let target = args[1];

            if (!target && message.message?.extendedTextMessage?.contextInfo?.participant) {
                target = message.message.extendedTextMessage.contextInfo.participant;
            }
            if (!target && message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]) {
                target = message.message.extendedTextMessage.contextInfo.mentionedJid[0];
            }

            if (!target) {
                return reply('❌ Tag a user or type the number.\nExample: `#sudo add @user`');
            }

            const number = cleanNumber(target);

            if (number.length < 8) {
                return reply('❌ Invalid number.');
            }

            if (sudoList.includes(number)) {
                return reply(`⚠️ ${number} is already a Sudo user.`);
            }

            sudoList.push(number);
            saveSudo(sudoList);

            return reply(`✅ Successfully added *${number}* as Sudo!`);
        }

        // DELETE
        if (['del', 'delete', 'remove', 'rm'].includes(action)) {
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

        return reply('❌ Invalid action.\nUse: `#sudo add`, `#sudo del` or `#sudo list`');
    }
};
