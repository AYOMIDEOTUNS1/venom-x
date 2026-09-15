module.exports = {
    name: "leave",
    aliases: ["leavegroup", "botleave", "out"],

    run: async function ({ sock, from, reply, isGroup, isOwner, message }) {
        if (!isGroup) {
            return reply("❌ #leave only works in a group.");
        }

        // Only owner (safer — bot won't leave if random members type it)
        if (!isOwner) {
            return reply("❌ Only the bot owner can use #leave.");
        }

        try {
            await reply(
`╭━━〔 👋 VENOM X LEAVE 〕━━⬣

Leaving this group...

╰━━━━━━━━━━━━━━━━⬣`
            );

            // small delay so the message can send
            await new Promise(function (r) {
                setTimeout(r, 800);
            });

            await sock.groupLeave(from);
        } catch (err) {
            console.log("LEAVE ERROR:", err.message);
            return reply("❌ Failed to leave:\n" + err.message);
        }
    }
};
