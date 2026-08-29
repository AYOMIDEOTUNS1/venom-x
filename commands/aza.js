module.exports = {
    name: "aza",
    aliases: ["acc", "account", "pay"],

    run: async ({ args, reply }) => {
        const choice = String(args[0] || "1").trim();

        // ===================== AZA 1 =====================
        if (choice === "1" || choice === "") {
            return reply(
`╭━━〔 💳 VENOM X AZA 〕━━⬣

🏦 Bank: Opay
🔢 Account Number: 7077417996
👤 Account Name: Ayomide Samson Oturarebi

📝 After payment, send receipt to:
📞 2349163743900

╰━━━━━━━━━━━━━━━━⬣`
            );
        }

        // ===================== AZA 2 =====================
        if (choice === "2") {
            return reply(
`╭━━〔 💳 VENOM X AZA 2 〕━━⬣

🏦 Bank: PalmPay
🔢 Account Number: 9163743900
👤 Account Name: Idowu Bolade Oturarebi

📝 After payment, send receipt to:
📞 2349163743900

╰━━━━━━━━━━━━━━━━⬣`
            );
        }

        // ===================== HELP =====================
        return reply(
`╭━━〔 💳 VENOM X AZA 〕━━⬣

Usage:
#aza
#aza 1
#aza 2

╰━━━━━━━━━━━━━━━━⬣`
        );
    }
};
