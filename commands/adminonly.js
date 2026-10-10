const groupMode = require("../lib/groupMode");

module.exports = {
    name: "adminonly",
    aliases: ["groupprivate", "gprivate", "admonly"],

    run: async function ({ sock, from, sender, args, reply, isGroup, isOwner, isSudo, isPrivileged }) {
        if (!isGroup && !from.endsWith("@g.us")) {
            return reply("❌ This command only works in groups.");
        }

        const mode = String((args && args[0]) || "status").toLowerCase();

        // only group admins / owner / sudo can toggle
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

        if (mode === "on" || mode === "off") {
            if (!isAdmin) {
                return reply("❌ Only *group admins* (or owner/sudo) can change this.");
            }
            const value = mode === "on";
            groupMode.setAdminOnly(from, value);
            return reply(
`╭━━〔 🛡️ VENOM X ADMIN-ONLY 〕━━⬣
┃
┃ Status : *${value ? "ON" : "OFF"}*
┃
┃ ${
    value
        ? "Only group admins can use the bot here.\n┃ Members' commands are ignored."
        : "Everyone can use the bot in this group again."
}
┃
┃ Toggle: #adminonly on / off
┃ Check:  #adminonly status
╰━━━━━━━━━━━━━━━━⬣`
            );
        }

        const current = groupMode.isAdminOnly(from);
        return reply(
`╭━━〔 🛡️ VENOM X ADMIN-ONLY 〕━━⬣
┃
┃ Status : *${current ? "ON" : "OFF"}*
┃
┃ When ON, only admins (and owner/sudo)
┃ can run commands in this group.
┃
┃ #adminonly on
┃ #adminonly off
┃ #adminonly status
╰━━━━━━━━━━━━━━━━⬣`
        );
    }
};
