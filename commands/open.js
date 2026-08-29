module.exports = {
    name: "open",
    aliases: ["unlock"],

    run: async ({
        sock,
        from,
        sender,
        reply
    }) => {

        if (!from?.endsWith("@g.us")) {
            return reply("❌ This command can only be used in groups.");
        }

        const metadata =
            await sock.groupMetadata(from);

        const participants =
            metadata?.participants || [];

        // ==============================
        // ROBUST JID / LID MATCHING
        // ==============================

        function normalizeId(value) {
            if (!value) return "";

            return String(value)
                .trim()
                .replace(/^whatsapp:/, "")
                .split("@")[0]
                .split(":")[0]
                .replace(/[^0-9]/g, "");
        }

        function sameUser(a, b) {
            const x = normalizeId(a);
            const y = normalizeId(b);

            return Boolean(x && y && x === y);
        }

        // ==============================
        // FIND SENDER
        // ==============================

        const senderData =
            participants.find(p =>
                sameUser(p?.id, sender) ||
                sameUser(p?.jid, sender) ||
                sameUser(p?.lid, sender)
            );

        // ==============================
        // FIND BOT
        // ==============================

        const botJid =
            sock.user?.id || null;

        const botLid =
            sock.user?.lid ||
            sock.user?.lid?.id ||
            null;

        const botNumber =
            normalizeId(botJid);

        const botData =
            participants.find(p =>
                sameUser(p?.id, botJid) ||
                sameUser(p?.jid, botJid) ||
                sameUser(p?.lid, botJid) ||
                sameUser(p?.id, botLid) ||
                sameUser(p?.jid, botLid) ||
                sameUser(p?.lid, botLid) ||
                normalizeId(p?.jid) === botNumber
            );

        console.log("🔓 OPEN ADMIN DEBUG:", {
            sender,
            senderParticipant: senderData,
            botJid,
            botLid,
            botNumber,
            botParticipant: botData
        });

        // ==============================
        // SENDER ADMIN
        // ==============================

        if (!senderData?.admin) {
            return reply(
`╭━━〔 🔓 VENOM X OPEN 〕━━⬣
┃
┃ ❌ Admins only.
┃
┃ Only group admins can open the group.
╰━━━━━━━━━━━━━━━━⬣`
            );
        }

        // ==============================
        // BOT ADMIN
        // ==============================

        if (!botData?.admin) {
            return reply(
`╭━━〔 🔓 VENOM X OPEN 〕━━⬣
┃
┃ ❌ VENOM X is not a group admin.
┃
┃ Promote VENOM X to admin first.
╰━━━━━━━━━━━━━━━━⬣`
            );
        }

        await sock.groupSettingUpdate(
            from,
            "not_announcement"
        );

        return reply(
`╭━━〔 🔓 VENOM X OPEN 〕━━⬣
┃
┃ ✅ Group unlocked.
┃ 👥 Everyone can chat.
╰━━━━━━━━━━━━━━━━⬣`
        );
    }
};
