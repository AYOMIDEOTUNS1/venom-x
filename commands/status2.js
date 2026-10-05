/**
 * VENOM X GROUP STATUS
 * #gcstatus text
 * reply media + #gcstatus caption
 * Owner / sudo only. Bot must be in the group.
 */

const { downloadContentFromMessage } = require("@whiskeysockets/baileys");
const { getSettings } = require("../lib/settingsCache");

function px() {
    try { return getSettings().prefix || "#"; } catch (e) { return "#"; }
}

function unwrap(msg) {
    let cur = msg;
    for (let i = 0; i < 6; i++) {
        const wrap =
            (cur && cur.viewOnceMessageV2 && cur.viewOnceMessageV2.message) ||
            (cur && cur.viewOnceMessage && cur.viewOnceMessage.message) ||
            (cur && cur.viewOnceMessageV2Extension && cur.viewOnceMessageV2Extension.message) ||
            (cur && cur.ephemeralMessage && cur.ephemeralMessage.message) ||
            (cur && cur.documentWithCaptionMessage && cur.documentWithCaptionMessage.message) ||
            null;
        if (!wrap) break;
        cur = wrap;
    }
    return cur || {};
}

function getQuoted(message) {
    const root = message.message || {};
    const parts = Object.keys(root);
    for (let i = 0; i < parts.length; i++) {
        const p = root[parts[i]];
        if (p && p.contextInfo && p.contextInfo.quotedMessage) {
            return unwrap(p.contextInfo.quotedMessage);
        }
    }
    return null;
}

async function download(node, type) {
    const stream = await downloadContentFromMessage(node, type);
    const chunks = [];
    for await (const c of stream) chunks.push(c);
    return Buffer.concat(chunks);
}

async function postGroupStatus(sock, groupJid, content) {
    // status@broadcast + statusJidList is how group status is targeted
    const jid = "status@broadcast";
    const msg = Object.assign({}, content, {
        statusJidList: [groupJid]
    });

    // background color for text statuses
    if (msg.text && !msg.backgroundColor) {
        msg.backgroundColor = "#9C27B0";
        msg.font = 0;
    }

    return sock.sendMessage(jid, msg, {
        statusJidList: [groupJid],
        backgroundColor: msg.backgroundColor || "#9C27B0"
    });
}

module.exports = {
    name: "gcstatus",
    aliases: ["status2", "gcs", "groupstatus", "gstatus"],

    run: async function ({ sock, from, args, reply, message, isGroup, isOwner, isPrivileged }) {
        if (!(isOwner || isPrivileged)) return reply("👑 Owner / sudo only.");
        if (!isGroup) return reply("❌ Use this inside the group you want to post to.");

        const caption = (args || []).join(" ").trim();
        const quoted = getQuoted(message);
        const p = px();

        try {
            let content = null;

            if (quoted && quoted.imageMessage) {
                const buf = await download(quoted.imageMessage, "image");
                content = { image: buf, caption: caption || "" };
            } else if (quoted && quoted.videoMessage) {
                const buf = await download(quoted.videoMessage, "video");
                content = { video: buf, caption: caption || "" };
            } else if (quoted && quoted.audioMessage) {
                const buf = await download(quoted.audioMessage, "audio");
                content = {
                    audio: buf,
                    mimetype: "audio/ogg; codecs=opus",
                    ptt: true
                };
            } else if (caption) {
                content = { text: caption, backgroundColor: "#9C27B0" };
            } else {
                return reply(
"╭━━〔 🟣 GROUP STATUS 〕━━⬣\n" +
"┃\n" +
"┃ Text:\n" +
"┃ " + p + "gcstatus Your text\n" +
"┃\n" +
"┃ Media:\n" +
"┃ Reply image/video/audio\n" +
"┃ then " + p + "gcstatus caption\n" +
"┃\n" +
"┃ Posts to THIS group's status.\n" +
"┃ Does not delete your message.\n" +
"┃\n" +
"╰━━━━━━━━━━━━━━━━⬣"
                );
            }

            await reply("🚀 Posting group status...");
            await postGroupStatus(sock, from, content);

            return reply(
"✅ Group status posted.\n\n" +
"Open the group → profile / status tray.\n" +
"It will not appear as a normal chat message."
            );
        } catch (e) {
            console.log("GCSTATUS ERROR:", e.message || e);
            return reply(
"❌ Group status failed:\n" +
String(e.message || e).slice(0, 220) +
"\n\nBot must be in the group. Some WA builds block group status from linked devices."
            );
        }
    }
};
