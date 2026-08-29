module.exports = {
    name: "add",
    aliases: [],

    run: async ({ sock, from, args, reply }) => {
        try {
            if (!from.endsWith("@g.us")) {
                return reply(
`╭━━〔 ➕ VENOM X ADD 〕━━⬣
┃
┃ ❌ This command only works
┃    inside WhatsApp groups.
┃
╰━━━━━━━━━━━━━━━━⬣`
                );
            }

            if (!args[0]) {
                return reply(
`╭━━〔 ➕ VENOM X ADD 〕━━⬣
┃
┃ 📌 Usage:
┃ .add 2348012345678
┃
┃ Example:
┃ .add 2349163743900
┃
╰━━━━━━━━━━━━━━━━⬣`
                );
            }

            const number = args[0].replace(/\D/g, "");

            if (number.length < 10) {
                return reply(
`╭━━〔 ➕ VENOM X ADD 〕━━⬣
┃
┃ ❌ Invalid phone number.
┃
┃ Example:
┃ .add 2348012345678
┃
╰━━━━━━━━━━━━━━━━⬣`
                );
            }

            const jid = number + "@s.whatsapp.net";

            await sock.groupParticipantsUpdate(
                from,
                [jid],
                "add"
            );

            return reply(
`╭━━〔 ➕ VENOM X ADD 〕━━⬣
┃
┃ ✅ User added successfully.
┃ 👤 ${number}
┃
┃ 🤖 Powered by VENOM X
╰━━━━━━━━━━━━━━━━⬣`
            );

        } catch (err) {
            console.log("ADD ERROR:", err.message);

            if (String(err.message).includes("account_reachout_restricted")) {
                try {
                    const inviteCode = await sock.groupInviteCode(from);

                    return reply(
`╭━━〔 ➕ VENOM X ADD 〕━━⬣
┃
┃ ⚠ WhatsApp blocked
┃ direct adding.
┃
┃ 🔗 Invite Link:
┃ https://chat.whatsapp.com/${inviteCode}
┃
┃ Send the link to
┃ the user instead.
╰━━━━━━━━━━━━━━━━⬣`
                    );
                } catch {
                    return reply(
`╭━━〔 ➕ VENOM X ADD 〕━━⬣
┃
┃ ❌ WhatsApp blocked
┃ direct adding.
┃
┃ Unable to generate
┃ invite link.
╰━━━━━━━━━━━━━━━━⬣`
                    );
                }
            }

            return reply(
`╭━━〔 ➕ VENOM X ADD 〕━━⬣
┃
┃ ❌ Failed to add user.
┃
┃ Try again later.
╰━━━━━━━━━━━━━━━━⬣`
            );
        }
    }
};
