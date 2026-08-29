const fs = require("fs");
const path = require("path");

const { createWelcomeCard } = require("../lib/welcomeCard");

const SETTINGS_FILE = path.join(__dirname, "..", "settings.json");
const WELCOME_DB = path.join(__dirname, "..", "database", "welcome.json");
const GOODBYE_DB = path.join(__dirname, "..", "database", "goodbye.json");

const processedEvents = new Map();
const EVENT_CACHE_TIME = 15000;

function getSettings() {
    try {
        return JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf8"));
    } catch {
        return {};
    }
}

function loadDb(file) {
    try {
        if (!fs.existsSync(file)) return {};
        return JSON.parse(fs.readFileSync(file, "utf8") || "{}");
    } catch {
        return {};
    }
}

function isWelcomeEnabled(groupId) {
    const db = loadDb(WELCOME_DB);
    if (Object.prototype.hasOwnProperty.call(db, groupId)) {
        return db[groupId] === true;
    }
    const settings = getSettings();
    return settings.welcome === true;
}

function isGoodbyeEnabled(groupId) {
    const db = loadDb(GOODBYE_DB);
    if (Object.prototype.hasOwnProperty.call(db, groupId)) {
        return db[groupId] === true;
    }
    const settings = getSettings();
    return settings.goodbye === true;
}

function socketIsUsable(sock) {
    return Boolean(sock && typeof sock.sendMessage === "function" && sock.ev);
}

function alreadyProcessed(key) {
    if (!key) return false;
    const now = Date.now();
    const previous = processedEvents.get(key);

    if (previous && now - previous < EVENT_CACHE_TIME) {
        return true;
    }

    processedEvents.set(key, now);

    for (const [eventKey, timestamp] of processedEvents) {
        if (now - timestamp > EVENT_CACHE_TIME) {
            processedEvents.delete(eventKey);
        }
    }

    return false;
}

function normalizeJid(value) {
    if (!value) return null;
    if (typeof value === "object") {
        value = value.id || value.jid || value.participant || value.phoneNumber || value.phone;
    }
    if (!value) return null;
    return String(value).trim().replace(/^whatsapp:/, "");
}

function getNumber(value) {
    const jid = normalizeJid(value);
    if (!jid) return "member";
    return jid.split("@")[0].split(":")[0].replace(/\D/g, "") || "member";
}

async function getGroupInfo(sock, groupJid) {
    try {
        const metadata = await sock.groupMetadata(groupJid);
        return {
            name: metadata?.subject || "Group",
            members: metadata?.participants?.length || 0
        };
    } catch {
        return { name: "Group", members: 0 };
    }
}

async function getMemberPicture(sock, memberJid, phoneNumber) {
    if (!socketIsUsable(sock) || typeof sock.profilePictureUrl !== "function") {
        return null;
    }

    const candidates = [];
    function add(value) {
        const jid = normalizeJid(value);
        if (jid && !candidates.includes(jid)) candidates.push(jid);
    }

    add(memberJid);
    if (phoneNumber) {
        const number = String(phoneNumber).replace(/\D/g, "");
        if (number) add(`${number}@s.whatsapp.net`);
    }

    for (const jid of candidates) {
        try {
            const request = sock.profilePictureUrl(jid, "image");
            const timeout = new Promise((resolve) => setTimeout(() => resolve(null), 1200));
            const result = await Promise.race([request, timeout]);
            if (result) return result;
        } catch {}
    }

    return null;
}

function removeTemp(file) {
    try {
        if (file && fs.existsSync(file)) fs.unlinkSync(file);
    } catch {}
}

async function sendWelcome(sock, groupJid, participant) {
    if (!isWelcomeEnabled(groupJid)) return;
    if (!socketIsUsable(sock)) return;

    const memberJid = normalizeJid(participant?.id || participant?.jid || participant);
    if (!memberJid) return;

    const phoneNumber =
        participant?.phoneNumber ||
        participant?.phone ||
        participant?.senderPn ||
        null;

    const eventKey = `welcome:\( {groupJid}: \){memberJid}`;
    if (alreadyProcessed(eventKey)) return;

    const group = await getGroupInfo(sock, groupJid);
    const number = getNumber(phoneNumber || memberJid);

    const caption =
`╭━━〔 👋 WELCOME 〕━━⬣

🎉 Welcome @${number}!

We're happy to have you here ❤️

🏠 Group : ${group.name}
👥 Members : ${group.members}

📜 Please take a moment to go through
the group rules before participating.

🤝 Respect everyone
🚫 No spam
🔞 Keep the group appropriate
⚠️ Follow the admins' instructions

✨ Enjoy your stay and have fun!

╰━━━━━━━━━━━━━━━━⬣`;

    let memberPic = null;
    try {
        memberPic = await getMemberPicture(sock, memberJid, phoneNumber);
    } catch {}

    if (memberPic) {
        let card = null;
        try {
            card = await createWelcomeCard(number, group.name, group.members, memberPic);
            if (card && fs.existsSync(card) && socketIsUsable(sock)) {
                await sock.sendMessage(groupJid, {
                    image: fs.readFileSync(card),
                    caption,
                    mentions: [memberJid]
                });
                console.log(`👋 WELCOME CARD SENT: ${number}`);
                removeTemp(card);
                return;
            }
        } catch {
            console.log("⚠️ Welcome card failed, using text.");
        }
        removeTemp(card);
    }

    try {
        await sock.sendMessage(groupJid, {
            text: caption,
            mentions: [memberJid]
        });
        console.log(`👋 WELCOME SENT: ${number}`);
    } catch (error) {
        console.log("WELCOME SEND ERROR:", error.message);
    }
}

async function sendGoodbye(sock, groupJid, participant) {
    if (!isGoodbyeEnabled(groupJid)) return;
    if (!socketIsUsable(sock)) return;

    const memberJid = normalizeJid(participant?.id || participant?.jid || participant);
    if (!memberJid) return;

    const phoneNumber =
        participant?.phoneNumber ||
        participant?.phone ||
        participant?.senderPn ||
        null;

    const eventKey = `goodbye:\( {groupJid}: \){memberJid}`;
    if (alreadyProcessed(eventKey)) {
        console.log(`⏭️ Duplicate goodbye ignored: ${memberJid}`);
        return;
    }

    const group = await getGroupInfo(sock, groupJid);
    const number = getNumber(phoneNumber || memberJid);

    const caption =
`╭━━〔 👋 GOODBYE 〕━━⬣

👋 Goodbye @${number}

🏠 Group : ${group.name}
👥 Members : ${group.members}

💔 We wish you well!

╰━━━━━━━━━━━━━━━━⬣`;

    let memberPic = null;
    try {
        memberPic = await getMemberPicture(sock, memberJid, phoneNumber);
    } catch {}

    if (memberPic) {
        try {
            if (!socketIsUsable(sock)) return;
            await sock.sendMessage(groupJid, {
                image: { url: memberPic },
                caption,
                mentions: [memberJid]
            });
            console.log(`👋 GOODBYE SENT: ${number} -> ${group.name}`);
            return;
        } catch {
            console.log("⚠️ Goodbye image failed, using text.");
        }
    }

    try {
        if (!socketIsUsable(sock)) return;
        await sock.sendMessage(groupJid, {
            text: caption,
            mentions: [memberJid]
        });
        console.log(`👋 GOODBYE TEXT SENT: ${number} -> ${group.name}`);
    } catch (error) {
        const message = String(error?.message || "").toLowerCase();
        if (!message.includes("connection closed")) {
            console.log("GOODBYE SEND ERROR:", error.message);
        }
    }
}

async function handleWelcome(sock, update) {
    if (!update || !update.id || !Array.isArray(update.participants)) return;
    if (update.action !== "add" && update.action !== "remove") return;

    console.log(`👥 GROUP UPDATE: ${update.action} -> ${update.id}`);

    for (const participant of update.participants) {
        if (!socketIsUsable(sock)) return;

        try {
            if (update.action === "add") {
                await sendWelcome(sock, update.id, participant);
            }
            if (update.action === "remove") {
                await sendGoodbye(sock, update.id, participant);
            }
        } catch (error) {
            const message = String(error?.message || "").toLowerCase();
            if (message.includes("connection closed")) return;
            console.log("GROUP PARTICIPANT ERROR:", error.message);
        }
    }
}

module.exports = handleWelcome;
