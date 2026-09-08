/**
 * 🔥 VENOM X - GROUP STATUS V4 (Clean + Stable)
 * Multi-group | Colors | Sudo Protected | No Auto-Delete
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { exec } = require('child_process');
const { promisify } = require('util');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

const execAsync = promisify(exec);

const CONFIG_PATH = path.join(__dirname, '../data/gcstatus.json');
const GROUPS_CACHE_FILE = path.join(__dirname, '../data/gcstatus_list.json');
const MEMORY_GROUP_CACHE = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000;
const COOLDOWN_MS = 8000;
const userCooldown = new Map();

const COLOR_MAP = {
    purple: '#9C27B0', violet: '#7B1FA2', pink: '#E91E63', hotpink: '#FF4081',
    red: '#F44336', orange: '#FF5722', amber: '#FF8F00', yellow: '#FFC107',
    lime: '#8BC34A', green: '#4CAF50', teal: '#009688', cyan: '#00BCD4',
    blue: '#2196F3', navy: '#1565C0', indigo: '#3F51B5', black: '#212121',
    dark: '#263238', grey: '#607D8B', white: '#FAFAFA', brown: '#795548',
    gold: '#F9A825', maroon: '#880E4F'
};
const DEFAULT_COLOR = '#9C27B0';

function tmp(ext) {
    return path.join(os.tmpdir(), `venom_\( {crypto.randomBytes(6).toString('hex')}. \){ext}`);
}

function loadConfig() {
    try {
        if (!fs.existsSync(CONFIG_PATH)) return {};
        return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    } catch { return {}; }
}

function saveConfig(cfg) {
    try {
        const dir = path.dirname(CONFIG_PATH);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
    } catch {}
}

function getGroupSettings(groupId) {
    const raw = loadConfig()[groupId];
    if (!raw) return { color: null, audience: 'all' };
    if (typeof raw === 'string') return { color: raw, audience: 'all' };
    return {
        color: raw.color ?? null,
        audience: raw.audience ?? 'all'
    };
}

function setGroupColor(groupId, value) {
    const cfg = loadConfig();
    cfg[groupId] = { ...getGroupSettings(groupId), color: value };
    saveConfig(cfg);
}

function setGroupAudience(groupId, value) {
    const cfg = loadConfig();
    cfg[groupId] = { ...getGroupSettings(groupId), audience: value };
    saveConfig(cfg);
}

function resolveColor(name) {
    if (!name) return null;
    const lower = name.toLowerCase().trim();
    if (COLOR_MAP[lower]) return COLOR_MAP[lower];
    const hex = lower.replace('#', '');
    if (/^[0-9a-f]{6}\( /i.test(hex)) return `# \){hex}`;
    return null;
}

function pickColor(groupId, inlineColor) {
    if (inlineColor && inlineColor !== 'random') return inlineColor;
    const saved = getGroupSettings(groupId).color;
    if (!saved || saved === 'random' || inlineColor === 'random') {
        return `#${Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0')}`;
    }
    return resolveColor(saved) || DEFAULT_COLOR;
}

function extractDigits(jid) {
    return String(jid || '').replace(/\D/g, '');
}

function loadGroupsDiskCache() {
    try {
        if (!fs.existsSync(GROUPS_CACHE_FILE)) return {};
        return JSON.parse(fs.readFileSync(GROUPS_CACHE_FILE, 'utf8'));
    } catch { return {}; }
}

function saveGroupsDiskCache(data) {
    try {
        const dir = path.dirname(GROUPS_CACHE_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(GROUPS_CACHE_FILE, JSON.stringify(data, null, 2));
    } catch {}
}

async function fetchUserGroups(sock, senderId, forceRefresh = false) {
    const senderKey = extractDigits(senderId) || 'default';

    if (!forceRefresh) {
        const cached = MEMORY_GROUP_CACHE.get(senderKey);
        if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.list;

        const disk = loadGroupsDiskCache();
        if (disk[senderKey]?.length) {
            MEMORY_GROUP_CACHE.set(senderKey, { list: disk[senderKey], ts: Date.now() });
            return disk[senderKey];
        }
    }

    let rawMap = {};
    try {
        if (typeof sock.groupFetchAllParticipating === 'function') {
            rawMap = await sock.groupFetchAllParticipating();
        }
    } catch (e) {
        console.warn('[GCSTATUS] Failed to fetch groups:', e.message);
    }

    if (!Object.keys(rawMap).length && sock.chats) {
        for (const [jid, chat] of Object.entries(sock.chats)) {
            if (jid.endsWith('@g.us')) {
                rawMap[jid] = { id: jid, subject: chat.name || chat.subject || jid };
            }
        }
    }

    const groups = Object.values(rawMap || {}).map((g) => ({
        jid: g.id,
        name: g.subject || g.id.replace('@g.us', '')
    })).sort((a, b) => a.name.localeCompare(b.name));

    groups.forEach((g, i) => g.index = i + 1);

    if (groups.length) {
        MEMORY_GROUP_CACHE.set(senderKey, { list: groups, ts: Date.now() });
        const disk = loadGroupsDiskCache();
        disk[senderKey] = groups;
        saveGroupsDiskCache(disk);
    }

    return groups;
}

function unwrapMessage(message) {
    let current = message;
    for (let i = 0; i < 6; i++) {
        const wrapper = current?.viewOnceMessageV2 || current?.viewOnceMessage ||
            current?.viewOnceMessageV2Extension || current?.documentWithCaptionMessage ||
            current?.ephemeralMessage;
        if (!wrapper?.message) break;
        current = wrapper.message;
    }
    return current;
}

function getMediaType(msg) {
    if (msg?.imageMessage) return 'image';
    if (msg?.videoMessage) return 'video';
    if (msg?.audioMessage) return 'audio';
    if (msg?.stickerMessage) return 'sticker';
    return null;
}

async function downloadMedia(message, type) {
    const mediaMsg = message[`${type}Message`];
    if (!mediaMsg) throw new Error(`No ${type} payload found`);
    const stream = await downloadContentFromMessage(mediaMsg, type);
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    return Buffer.concat(chunks);
}

async function convertToVoice(buffer) {
    const input = tmp('input');
    const output = tmp('ogg');

    try {
        fs.writeFileSync(input, buffer);
        await execAsync(`ffmpeg -hide_banner -loglevel error -y -i "\( {input}" -vn -c:a libopus -b:a 64k -ar 48000 -ac 1 " \){output}"`);
        return fs.readFileSync(output);
    } finally {
        try { fs.unlinkSync(input); } catch {}
        try { fs.unlinkSync(output); } catch {}
    }
}

async function postGroupStatus(sock, jid, content, color, audience = 'all') {
    const statusSourceType = content.text ? 'TEXT' :
        content.image ? 'IMAGE' :
        content.video ? 'VIDEO' :
        content.audio ? 'AUDIO' :
        content.sticker ? 'IMAGE' : 'TEXT';

    const payload = {
        ...content,
        contextInfo: {
            isGroupStatus: true,
            statusSourceType,
            statusAttributions: [{ type: 10 }],
            statusAudienceMetadata: {
                audienceType: audience === 'close' ? 'CLOSE_FRIENDS' : 'ALL'
            }
        }
    };

    if (content.text) {
        payload.backgroundColor = color || DEFAULT_COLOR;
    }

    return sock.sendMessage(jid, payload);
}

module.exports = {
    name: "status2",
    aliases: ["gcstatus", "gstatus", "groupstatus", "gcs"],

    run: async ({ sock, from, message, args, reply, isGroup, isOwner, isSudo, sender }) => {

        // Only Owner + Sudo
        if (!isOwner && !isSudo) {
            return reply('🚫 *Owner / Sudo only.*');
        }

        // Cooldown
        const now = Date.now();
        if (userCooldown.has(sender) && now - userCooldown.get(sender) < COOLDOWN_MS) {
            const left = Math.ceil((COOLDOWN_MS - (now - userCooldown.get(sender))) / 1000);
            return reply(`⏳ Wait *${left}s* before using this again.`);
        }

        const text = args.join(' ').trim();
        const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage ||
            message.message?.imageMessage?.contextInfo?.quotedMessage ||
            message.message?.videoMessage?.contextInfo?.quotedMessage ||
            message.message?.audioMessage?.contextInfo?.quotedMessage;

        // Help menu
        if (!text && !quoted) {
            return reply(`╭━━━『 *VENOM X GROUP STATUS V4* 』━━━
│
│  *Text Status*
│  ▸ #gcstatus Hello world
│  ▸ #gcstatus 1,3,5 Hello
│  ▸ #gcstatus all Big announcement
│
│  *Media Status*
│  ▸ Reply to image/video/audio/sticker
│  ▸ #gcstatus 1,2
│  ▸ #gcstatus all
│
│  *Colors*
│  ▸ #gcstatus --color gold Hello
│  ▸ #gcstatus --color #FF0000 Hello
│  ▸ #gcstatus --color random Hello
│
│  *Settings*
│  ▸ #gcstatus list
│  ▸ #gcstatus setcolor purple
│  ▸ #gcstatus setaudience close
│
╰━━━━━━━━━━━━━━━━━━━━━━━━━━
*Only Owner + Sudo*`);
        }

        // List groups
        if (text.toLowerCase() === 'list') {
            const list = await fetchUserGroups(sock, sender, true);
            if (!list.length) return reply('❌ No groups found.');

            const formatted = list.map(g => `│  *${g.index}.* ${g.name}`).join('\n');
            return reply(`╭━━━『 📋 *YOUR GROUPS* 』━━━
│  Total: *${list.length}*
│
${formatted}
│
│  Usage: #gcstatus 1,3,5 text
╰━━━━━━━━━━━━━━━━━━━━━`);
        }

        // Set color
        if (text.toLowerCase().startsWith('setcolor')) {
            if (!isGroup) return reply('❌ Use this inside a group.');
            const colorName = text.slice(8).trim().toLowerCase();
            if (!colorName) return reply('Example: #gcstatus setcolor purple');
            if (colorName === 'random') {
                setGroupColor(from, 'random');
                return reply('✅ Group color set to *random*');
            }
            const resolved = resolveColor(colorName);
            if (!resolved) return reply(`❌ Invalid color.\nAvailable: ${Object.keys(COLOR_MAP).join(', ')}`);
            setGroupColor(from, colorName);
            return reply(`✅ Group color saved as *${colorName}*`);
        }

        // Set audience
        if (text.toLowerCase().startsWith('setaudience')) {
            if (!isGroup) return reply('❌ Use this inside a group.');
            const val = text.slice(11).trim().toLowerCase();
            if (!['all', 'close', 'closefriends'].includes(val)) {
                return reply('Usage: #gcstatus setaudience all / close');
            }
            setGroupAudience(from, val === 'all' ? 'all' : 'close');
            return reply(`✅ Audience set to *${val}*`);
        }

        // Parse targets
        let targetSpecs = [];
        let contentText = text;
        let inlineColor = null;

        const colorMatch = contentText.match(/(?:--color|--colour)[= ]+([^\s]+)/i);
        if (colorMatch) {
            const c = colorMatch[1].toLowerCase();
            inlineColor = c === 'random' ? 'random' : resolveColor(c);
            contentText = contentText.replace(colorMatch[0], '').trim();
        }

        const firstToken = contentText.split(/\s+/)[0] || '';
        if (/^(all|\*|(\d+)([,-]\d+)*)$/i.test(firstToken) || firstToken.endsWith('@g.us')) {
            const targets = firstToken.toLowerCase();
            if (targets === 'all' || targets === '*') {
                targetSpecs = [{ type: 'all' }];
            } else if (targets.includes(',')) {
                targetSpecs = targets.split(',').map(n => ({ type: 'index', value: parseInt(n) }));
            } else if (targets.includes('-')) {
                const [start, end] = targets.split('-').map(Number);
                for (let i = Math.min(start, end); i <= Math.max(start, end); i++) {
                    targetSpecs.push({ type: 'index', value: i });
                }
            } else if (/^\d+$/.test(targets)) {
                targetSpecs = [{ type: 'index', value: parseInt(targets) }];
            } else if (targets.endsWith('@g.us')) {
                targetSpecs = [{ type: 'jid', value: targets }];
            }
            contentText = contentText.slice(firstToken.length).trim();
        } else if (isGroup) {
            targetSpecs = [{ type: 'jid', value: from }];
        }

        const groups = await fetchUserGroups(sock, sender);
        let targetJids = [];

        for (const spec of targetSpecs) {
            if (spec.type === 'all') {
                targetJids = groups.map(g => g.jid);
                break;
            }
            if (spec.type === 'jid') targetJids.push(spec.value);
            if (spec.type === 'index') {
                const found = groups.find(g => g.index === spec.value);
                if (found) targetJids.push(found.jid);
            }
        }

        targetJids = [...new Set(targetJids)];

        if (!targetJids.length) {
            return reply('❌ No valid groups found.\nUse *#gcstatus list* to see your groups.');
        }

        // Build content
        let content = {};
        try {
            if (quoted) {
                const mediaPayload = unwrapMessage(quoted);
                const type = getMediaType(mediaPayload);

                if (!type) return reply('❌ Reply to an image, video, audio or sticker.');

                const buffer = await downloadMedia(mediaPayload, type);
                if (!buffer?.length) throw new Error('Failed to download media');

                if (type === 'audio') {
                    const voice = await convertToVoice(buffer);
                    content = {
                        audio: voice,
                        mimetype: 'audio/ogg; codecs=opus',
                        ptt: true
                    };
                } else if (type === 'sticker') {
                    content = { sticker: buffer };
                } else {
                    content = {
                        [type]: buffer,
                        caption: contentText || ''
                    };
                }
            } else {
                if (!contentText) return reply('❌ Please provide text or reply to media.');
                content = { text: contentText };
            }
        } catch (err) {
            console.error('[GCSTATUS] Media Error:', err);
            return reply(`❌ Failed to process media: ${err.message}`);
        }

        // Start posting
        userCooldown.set(sender, Date.now());
        await reply(`🚀 Posting to *${targetJids.length}* group(s)...`);

        let success = 0;
        let failed = 0;

        for (const jid of targetJids) {
            try {
                const color = pickColor(jid, inlineColor);
                const audience = getGroupSettings(jid).audience || 'all';
                await postGroupStatus(sock, jid, content, color, audience);
                success++;
            } catch (e) {
                console.error(`[GCSTATUS] Failed on ${jid}:`, e.message);
                failed++;
            }

            if (targetJids.length > 1) {
                await new Promise(r => setTimeout(r, 800));
            }
        }

        return reply(`✅ *Group Status Posted!*\n\n• Success: *\( {success}*\n• Failed: * \){failed}*\n• Total: *${targetJids.length}*`);
    }
};
