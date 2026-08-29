const warningEngine = require("../lib/warningEngine");

function getMentioned(message) {
    const context =
        message?.message?.extendedTextMessage?.contextInfo ||
        message?.message?.imageMessage?.contextInfo ||
        message?.message?.videoMessage?.contextInfo ||
        message?.message?.documentMessage?.contextInfo ||
        {};

    return context.mentionedJid?.[0] || null;
}

function normalizeId(id) {
    return String(id || "")
        .replace(/:\d+(?=@)/, "")
        .split("@")[0]
        .trim();
}

function sameUser(a, b) {
    if (!a || !b) return false;

    const x = String(a);
    const y = String(b);

    if (x === y) return true;

    return normalizeId(x) === normalizeId(y);
}

function isAdmin(participant) {
    return (
        participant?.admin === "admin" ||
        participant?.admin === "superadmin" ||
        participant?.admin === true
    );
}

function findParticipant(participants, jid) {
    if (!jid) return null;

    return participants.find(p =>
        sameUser(p?.id, jid) ||
        sameUser(p?.jid, jid)
    ) || null;
}

module.exports = {
    name: "warn",
    aliases: ["warning"],

    run: async ({
        sock,
        from,
        message,
        sender,
        args,
        reply
    }) => {

        // =================================================
        // GROUP ONLY
        // =================================================

        if (!from?.endsWith("@g.us")) {
            return reply(
                "❌ This command can only be used in groups."
            );
        }

        // =================================================
        // GROUP METADATA
        // =================================================

        let metadata;

        try {
            metadata = await sock.groupMetadata(from);
        } catch (error) {
            console.error(
                "WARN GROUP METADATA ERROR:",
                error.message
            );

            return reply(
                "❌ Failed to read group information."
            );
        }

        const participants =
            metadata?.participants || [];

        // =================================================
        // FIND SENDER
        // =================================================

        const senderData =
            findParticipant(
                participants,
                sender
            );

        // =================================================
        // FIND BOT
        // =================================================

        const botIds = [
            sock.user?.id,
            sock.user?.lid,
            sock.user?.jid
        ].filter(Boolean);

        let botData = null;

        for (const botId of botIds) {
            botData =
                findParticipant(
                    participants,
                    botId
                );

            if (botData) break;
        }

        // Extra fallback:
        // compare the bot's normalized phone number
        if (!botData && sock.user?.id) {
            const botNumber =
                normalizeId(sock.user.id);

            botData = participants.find(p =>
                normalizeId(p?.id) === botNumber ||
                normalizeId(p?.jid) === botNumber
            );
        }

        console.log("⚠️ WARN ADMIN DEBUG:", {
            sender,
            senderAdmin: senderData?.admin,
            botId: sock.user?.id,
            botLid: sock.user?.lid,
            botParticipant: botData?.id,
            botParticipantJid: botData?.jid,
            botAdmin: botData?.admin
        });

        // =================================================
        // SENDER ADMIN CHECK
        // =================================================

        if (!isAdmin(senderData)) {
            return reply(
`╭━━〔 ⚠️ VENOM WARN 〕━━⬣
┃
┃ ❌ Admins only.
┃
┃ Only group admins can warn members.
╰━━━━━━━━━━━━━━━━⬣`
            );
        }

        // =================================================
        // BOT ADMIN CHECK
        // =================================================

        if (!isAdmin(botData)) {
            return reply(
`╭━━〔 ⚠️ VENOM WARN 〕━━⬣
┃
┃ ❌ VENOM X must be a group admin
┃ to manage warnings.
┃
┃ Make VENOM X a group admin
┃ and try again.
╰━━━━━━━━━━━━━━━━⬣`
            );
        }

        // =================================================
        // TARGET
        // =================================================

        const target =
            getMentioned(message);

        if (!target) {
            return reply(
`╭━━〔 ⚠️ VENOM WARN 〕━━⬣
┃
┃ Usage:
┃ #warn @user [reason]
┃
┃ Example:
┃ #warn @user Spamming
╰━━━━━━━━━━━━━━━━⬣`
            );
        }

        // =================================================
        // PROTECT SELF
        // =================================================

        if (sameUser(target, sender)) {
            return reply(
                "😂 You can't warn yourself."
            );
        }

        // =================================================
        // FIND TARGET
        // =================================================

        const targetData =
            findParticipant(
                participants,
                target
            );

        // =================================================
        // PROTECT ADMINS
        // =================================================

        if (isAdmin(targetData)) {
            return sock.sendMessage(
                from,
                {
                    text:
`🛡️ @${normalizeId(target)}
is a group admin and cannot be warned.`,
                    mentions: [target]
                },
                {
                    quoted: message
                }
            );
        }

        // =================================================
        // REASON
        // =================================================

        const reason =
            args
                .slice(1)
                .join(" ")
                .trim() ||
            "No reason provided";

        // =================================================
        // ADD WARNING
        // =================================================

        const result =
            warningEngine.addWarning(
                from,
                target,
                reason
            );

        // =================================================
        // MAX WARNINGS
        // =================================================

        if (
            result.count >=
            warningEngine.MAX_WARNINGS
        ) {

            warningEngine.resetWarnings(
                from,
                target
            );

            try {
                await sock.groupParticipantsUpdate(
                    from,
                    [target],
                    "remove"
                );
            } catch (error) {
                console.error(
                    "WARN REMOVE ERROR:",
                    error.message
                );

                // Restore warning
                warningEngine.addWarning(
                    from,
                    target,
                    reason
                );

                return sock.sendMessage(
                    from,
                    {
                        text:
`╭━━〔 🚨 VENOM WARN 〕━━⬣
┃
┃ 👤 @${normalizeId(target)}
┃
┃ ⚠️ Warning : ${warningEngine.MAX_WARNINGS}/${warningEngine.MAX_WARNINGS}
┃
┃ ❌ Removal failed.
┃
┃ Make sure VENOM X is a group admin.
╰━━━━━━━━━━━━━━━━⬣`,
                        mentions: [target]
                    },
                    {
                        quoted: message
                    }
                );
            }

            return sock.sendMessage(
                from,
                {
                    text:
`╭━━〔 🚫 VENOM WARN 〕━━⬣
┃
┃ 👤 @${normalizeId(target)}
┃
┃ ⚠️ Warning : ${warningEngine.MAX_WARNINGS}/${warningEngine.MAX_WARNINGS}
┃
┃ 📝 Reason:
┃ ${reason}
┃
┃ 🚪 Maximum warnings reached.
┃
┃ ❌ Member removed from the group.
╰━━━━━━━━━━━━━━━━⬣`,
                    mentions: [target]
                },
                {
                    quoted: message
                }
            );
        }

        // =================================================
        // NORMAL WARNING
        // =================================================

        const remaining =
            warningEngine.MAX_WARNINGS -
            result.count;

        return sock.sendMessage(
            from,
            {
                text:
`╭━━〔 ⚠️ VENOM WARN 〕━━⬣
┃
┃ 👤 @${normalizeId(target)}
┃
┃ ⚠️ Warning : ${result.count}/${warningEngine.MAX_WARNINGS}
┃
┃ 📝 Reason:
┃ ${reason}
┃
┃ 🚨 Warnings left : ${remaining}
┃
┃ ${
    remaining === 1
        ? "⚠️ Next warning may remove you."
        : "Please follow the group rules."
}
╰━━━━━━━━━━━━━━━━⬣`,
                mentions: [target]
            },
            {
                quoted: message
            }
        );
    }
};
