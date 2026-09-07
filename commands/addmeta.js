const { jidNormalizedUser } = require("@whiskeysockets/baileys");

const META_AI_JID = "867051314767696@bot";

module.exports = {
    name: "addmeta",
    aliases: ["meta", "addmetai", "metai"],

    run: async function ({ sock, from, sender, args, reply, isGroup, isOwner }) {
        try {
            let targetGroup;

            if (args[0]) {
                targetGroup = String(args[0]).trim();
                if (!targetGroup.endsWith("@g.us")) {
                    targetGroup = targetGroup + "@g.us";
                }
            } else if (isGroup) {
                targetGroup = from;
            } else {
                return reply(
`╭━━〔 👾 ADD META AI 〕━━⬣

Usage:
• In a group: #addmeta
• From DM (owner): #addmeta <groupjid>

Example:
#addmeta 120363401234567890@g.us

Notes:
• Group may block if only admins can add
• Bot should be admin when required

╰━━━━━━━━━━━━━━━━⬣`
                );
            }

            const isRemote = Boolean(args[0]);
            if (isRemote && !isOwner) {
                return reply("❌ Only the owner can add Meta AI from DM.");
            }

            let groupMeta;
            try {
                groupMeta = await sock.groupMetadata(targetGroup);
            } catch (e) {
                return reply("❌ Group not found. Check JID and that the bot is a member.");
            }

            if (!isRemote) {
                const senderNum = String(sender || "")
                    .split(":")[0]
                    .split("@")[0]
                    .replace(/\D/g, "");

                const senderParticipant = (groupMeta.participants || []).find(function (p) {
                    const id = String(p.id || "").split(":")[0].split("@")[0].replace(/\D/g, "");
                    return id && senderNum && id === senderNum;
                });

                const isSenderAdmin =
                    senderParticipant &&
                    (senderParticipant.admin === "admin" ||
                        senderParticipant.admin === "superadmin");

                if (!isSenderAdmin && !isOwner) {
                    return reply("❌ You must be a group admin to use #addmeta.");
                }
            }

            let botId = null;
            try {
                botId = jidNormalizedUser(sock.user.id);
            } catch (e) {
                botId = sock.user && sock.user.id;
            }

            const botParticipant = (groupMeta.participants || []).find(function (p) {
                return (
                    p.id === botId ||
                    String(p.id).split(":")[0] === String(botId).split(":")[0]
                );
            });

            const isBotAdmin =
                botParticipant &&
                (botParticipant.admin === "admin" || botParticipant.admin === "superadmin");

            if (groupMeta.memberAddMode === false && !isBotAdmin) {
                return reply(
                    "❌ Only admins can add members in *" +
                        groupMeta.subject +
                        "*, and the bot is not admin."
                );
            }

            await reply("👾 Adding Meta AI to *" + groupMeta.subject + "*...");

            const result = await sock.groupParticipantsUpdate(
                targetGroup,
                [META_AI_JID],
                "add"
            );

            const status = result && result[0] && result[0].status;

            if (String(status) === "200") {
                return reply(
                    "✅ Meta AI added to: *" +
                        groupMeta.subject +
                        "*\n\nMention Meta AI there to chat."
                );
            }

            if (String(status) === "409") {
                return reply("ℹ️ Meta AI is already in: *" + groupMeta.subject + "*");
            }

            return reply("❌ Failed to add Meta AI.\nStatus: " + (status || "unknown"));
        } catch (e) {
            console.log("ADDMETA ERROR:", e.message);
            const msg = String(e.message || e);
            if (msg.includes("not-authorized") || msg.includes("403")) {
                return reply(
                    "❌ WhatsApp rejected the action. Make the bot admin or enable members can add."
                );
            }
            return reply("❌ Action failed:\n" + msg);
        }
    }
};
