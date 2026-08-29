module.exports = {
    name: "close",
    aliases: ["lock"],

    run: async ({
        sock,
        from,
        sender,
        reply,
        args
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

        console.log("🔐 CLOSE ADMIN DEBUG:", {
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
`╭━━〔 🔒 VENOM X CLOSE 〕━━⬣
┃
┃ ❌ Admins only.
┃
┃ Only group admins can close the group.
╰━━━━━━━━━━━━━━━━⬣`
            );
        }

        // ==============================
        // BOT ADMIN
        // ==============================

        if (!botData?.admin) {
            return reply(
`╭━━〔 🔒 VENOM X CLOSE 〕━━⬣
┃
┃ ❌ VENOM X is not a group admin.
┃
┃ Promote VENOM X to admin first.
╰━━━━━━━━━━━━━━━━⬣`
            );
        }

        // ==============================
        // DURATION
        // ==============================

        const duration =
            args?.join(" ").trim();

        // Validate BEFORE locking.

        let milliseconds = null;

        if (duration) {

            const match =
                duration
                    .toLowerCase()
                    .match(
                        /^(\d+(?:\.\d+)?)\s*(s|sec|secs|second|seconds|m|min|mins|minute|minutes|h|hr|hrs|hour|hours|d|day|days)$/
                    );

            if (!match) {
                return reply(
`╭━━〔 🔒 VENOM X CLOSE 〕━━⬣
┃
┃ ❌ Invalid duration.
┃
┃ Examples:
┃ #close 30mins
┃ #close 9hrs
┃ #close 2hours
┃ #close 45m
╰━━━━━━━━━━━━━━━━⬣`
                );
            }

            const amount =
                Number(match[1]);

            const unit =
                match[2];

            if (
                ["s", "sec", "secs", "second", "seconds"]
                    .includes(unit)
            ) {
                milliseconds =
                    amount * 1000;

            } else if (
                ["m", "min", "mins", "minute", "minutes"]
                    .includes(unit)
            ) {
                milliseconds =
                    amount * 60 * 1000;

            } else if (
                ["h", "hr", "hrs", "hour", "hours"]
                    .includes(unit)
            ) {
                milliseconds =
                    amount * 60 * 60 * 1000;

            } else {
                milliseconds =
                    amount * 24 * 60 * 60 * 1000;
            }
        }

        // ==============================
        // CLOSE GROUP
        // ==============================

        await sock.groupSettingUpdate(
            from,
            "announcement"
        );

        if (!duration) {
            return reply(
`╭━━〔 🔒 VENOM X CLOSE 〕━━⬣
┃
┃ ✅ Group locked.
┃
┃ 👑 Admins only.
╰━━━━━━━━━━━━━━━━⬣`
            );
        }

        await reply(
`╭━━〔 🔒 VENOM X CLOSE 〕━━⬣
┃
┃ ✅ Group locked.
┃
┃ 👑 Admins only.
┃
┃ ⏱ Duration : ${duration}
┃
┃ 🔓 Group will automatically open
┃ after the timer expires.
╰━━━━━━━━━━━━━━━━⬣`
        );

        // ==============================
        // AUTO OPEN
        // ==============================

        setTimeout(async () => {

            try {

                await sock.groupSettingUpdate(
                    from,
                    "not_announcement"
                );

                await sock.sendMessage(
                    from,
                    {
                        text:
`╭━━〔 🔓 VENOM X OPEN 〕━━⬣
┃
┃ ⏰ Close timer expired.
┃
┃ ✅ Group automatically unlocked.
┃ 👥 Everyone can chat.
╰━━━━━━━━━━━━━━━━⬣`
                    }
                );

                console.log(
                    `🔓 AUTO OPEN: ${from} after ${duration}`
                );

            } catch (error) {

                console.error(
                    "AUTO OPEN ERROR:",
                    error.message
                );
            }

        }, milliseconds);
    }
};
