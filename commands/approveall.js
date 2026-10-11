module.exports = {
    name: "approveall",
    aliases: ["acceptjoin", "approvejoins", "joinapprove"],

    run: async function ({ sock, from, sender, reply, isGroup, isOwner, isSudo, isPrivileged }) {
        if (!isGroup && !from.endsWith("@g.us")) {
            return reply("❌ Group only.");
        }

        let isAdmin = isPrivileged || isOwner || isSudo;
        if (!isAdmin) {
            try {
                const meta = await sock.groupMetadata(from);
                const p = (meta.participants || []).find(function (x) {
                    const id = x.id || x.jid || "";
                    return id === sender || id.split("@")[0] === String(sender).split("@")[0];
                });
                const rank = p && (p.admin || p.isAdmin || p.isSuperAdmin);
                isAdmin = rank === "admin" || rank === "superadmin" || rank === true;
            } catch (e) {}
        }

        if (!isAdmin) {
            return reply("❌ Only *group admins* can approve join requests.");
        }

        try {
            let pending = [];
            if (typeof sock.groupRequestParticipantsList === "function") {
                pending = await sock.groupRequestParticipantsList(from);
            }

            if (!pending || !pending.length) {
                return reply(
`╭━━〔 👥 APPROVE ALL 〕━━⬣
┃
┃ No pending join requests.
╰━━━━━━━━━━━━━━━━⬣`
                );
            }

            const jids = pending
                .map(function (p) {
                    return p.jid || p.id || p.participant || null;
                })
                .filter(Boolean);

            if (!jids.length) {
                return reply("❌ Could not read pending request IDs.");
            }

            await reply("⏳ Approving *" + jids.length + "* request(s)…");

            if (typeof sock.groupRequestParticipantsUpdate === "function") {
                await sock.groupRequestParticipantsUpdate(from, jids, "approve");
            } else {
                return reply("❌ This Baileys build has no join-request API.");
            }

            return reply(
`╭━━〔 ✅ APPROVE ALL 〕━━⬣
┃
┃ Approved : *${jids.length}*
┃
┃ Pending join requests accepted.
╰━━━━━━━━━━━━━━━━⬣`
            );
        } catch (err) {
            console.error("[APPROVEALL]", err);
            return reply(
                "❌ Failed to approve requests:\n" +
                    (err.message || err) +
                    "\n\nMake sure the *bot is admin*."
            );
        }
    }
};
