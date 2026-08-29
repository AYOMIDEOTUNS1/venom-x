const fs = require("fs");
const path = require("path");

module.exports = {
    name: "vcf",
    aliases: ["contacts", "saveall"],

    async run({ sock, from, message, reply, args }) {
        try {
            // =========================
            // GROUP ONLY
            // =========================
            if (!from || !from.endsWith("@g.us")) {
                return reply("❌ This command can only be used in a group.");
            }

            // =========================
            // PREFIX / SAVE-AS NAME
            // =========================
            // .vcf       → VENOM X.vcf
            // .vcf CSX   → CSX.vcf
            let prefix = args.join(" ").trim() || "VENOM X";

            // Make the name safe for Android/Linux filenames
            prefix = prefix
                .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
                .replace(/\s+/g, " ")
                .trim();

            if (!prefix) {
                prefix = "VENOM X";
            }

            // =========================
            // GET GROUP MEMBERS
            // =========================
            const metadata = await sock.groupMetadata(from);

            if (
                !metadata ||
                !Array.isArray(metadata.participants) ||
                metadata.participants.length === 0
            ) {
                return reply("❌ No group members found.");
            }

            const contacts = [];
            const seenNumbers = new Set();

            let unnamedCount = 1;

            // =========================
            // COLLECT CONTACTS
            // =========================
            for (const member of metadata.participants) {
                try {
                    /*
                     * Baileys can expose participants as:
                     * - @s.whatsapp.net
                     * - @lid
                     *
                     * Prefer the normal JID first.
                     */
                    const jid =
                        member.jid ||
                        member.id ||
                        null;

                    if (!jid) continue;

                    let number = null;

                    // =========================
                    // NORMAL WHATSAPP JID
                    // =========================
                    if (jid.endsWith("@s.whatsapp.net")) {
                        number = jid
                            .split("@")[0]
                            .split(":")[0]
                            .replace(/\D/g, "");
                    }

                    /*
                     * LID handling:
                     *
                     * Do NOT call onWhatsApp() for every member.
                     * That creates a network request per member and
                     * can make VCF generation very slow in large groups.
                     */
                    if (!number && jid.endsWith("@lid")) {
                        // Some Baileys versions expose the phone JID
                        // through participant.phoneNumber.
                        const phoneJid =
                            member.phoneNumber ||
                            member.phoneJid ||
                            null;

                        if (
                            phoneJid &&
                            phoneJid.endsWith("@s.whatsapp.net")
                        ) {
                            number = phoneJid
                                .split("@")[0]
                                .split(":")[0]
                                .replace(/\D/g, "");
                        }
                    }

                    /*
                     * If we cannot obtain a real phone number without
                     * an additional lookup, skip this participant.
                     * This keeps the command fast and reliable.
                     */
                    if (!number) continue;

                    if (number.length < 7) continue;

                    // =========================
                    // REMOVE DUPLICATES
                    // =========================
                    if (seenNumbers.has(number)) continue;

                    seenNumbers.add(number);

                    // =========================
                    // MEMBER NAME
                    // =========================
                    let name =
                        member.notify ||
                        member.name ||
                        member.verifiedName ||
                        member.pushName ||
                        "";

                    name = String(name)
                        .replace(/[\r\n;]/g, " ")
                        .replace(/\s+/g, " ")
                        .trim();

                    // =========================
                    // UNNAMED MEMBER
                    // =========================
                    if (!name) {
                        name =
                            `${prefix} STUDENT ` +
                            String(unnamedCount).padStart(3, "0");

                        unnamedCount++;
                    }

                    contacts.push({
                        name,
                        number
                    });

                } catch (memberError) {
                    console.log(
                        "VCF MEMBER ERROR:",
                        memberError.message
                    );
                }
            }

            // =========================
            // NO CONTACTS
            // =========================
            if (contacts.length === 0) {
                return reply(
                    "❌ No phone-number contacts could be exported."
                );
            }

            // =========================
            // BUILD VCF
            // =========================
            const vcfParts = [];

            for (const contact of contacts) {
                vcfParts.push(
`BEGIN:VCARD
VERSION:3.0
N:${contact.name};;;;
FN:${contact.name}
TEL;TYPE=CELL:+${contact.number}
END:VCARD`
                );
            }

            const vcf = vcfParts.join("\r\n");

            // =========================
            // FILE NAME
            // =========================
            const fileName = `${prefix}.vcf`;

            const filePath = path.join(
                __dirname,
                "..",
                fileName
            );

            // =========================
            // WRITE FILE
            // =========================
            fs.writeFileSync(
                filePath,
                vcf,
                "utf8"
            );

            // =========================
            // STATISTICS
            // =========================
            const unnamedPrefix = `${prefix} STUDENT `;

            const unnamedContacts = contacts.filter(
                contact => contact.name.startsWith(unnamedPrefix)
            ).length;

            const namedContacts =
                contacts.length - unnamedContacts;

            // =========================
            // SEND VCF
            // =========================
            await sock.sendMessage(
                from,
                {
                    document: fs.readFileSync(filePath),
                    mimetype: "text/vcard",
                    fileName,
                    caption:
`╭━━〔 📇 VENOM X VCF 〕━━⬣
┃
┃ ✅ Contacts exported
┃
┃ 📁 File: ${fileName}
┃ 👥 Group: ${metadata.subject || "Unknown"}
┃ 📱 Contacts: ${contacts.length}
┃ 👤 Named: ${namedContacts}
┃ 🎓 Unnamed: ${unnamedContacts}
┃
╰━━━━━━━━━━━━━━━━⬣`
                },
                {
                    quoted: message
                }
            );

            // =========================
            // DELETE TEMPORARY FILE
            // =========================
            try {
                fs.unlinkSync(filePath);
            } catch {}

            console.log(
                `✅ VCF created: ${fileName} (${contacts.length} contacts)`
            );

        } catch (err) {
            console.log("VCF ERROR:", err);

            try {
                await reply(
                    `❌ Failed to create contact file.\n\n${err.message}`
                );
            } catch {}
        }
    }
};
