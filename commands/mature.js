/**
 * Mature & Useful Commands
 * #define #wiki #crypto #currency #remind #summary #rewrite #bio
 */

const axios = require("axios");

module.exports = {
    name: "mature",
    aliases: ["define", "wiki", "crypto", "currency", "remind", "summary", "rewrite", "bio"],

    run: async function ({ sock, from, args, reply, message, sender, commandName }) {
        const cmd = String(commandName || "").toLowerCase();
        const text = args.join(" ").trim();

        // ==================== DEFINE ====================
        if (cmd === "define") {
            if (!text) return reply("📚 Usage: #define <word>");
            try {
                const { data } = await axios.get(
                    "https://api.dictionaryapi.dev/api/v2/entries/en/" + encodeURIComponent(text),
                    { timeout: 12000 }
                );
                const entry = data[0];
                const meaning = entry.meanings && entry.meanings[0];
                const definition = meaning && meaning.definitions && meaning.definitions[0] && meaning.definitions[0].definition;
                const example = (meaning && meaning.definitions && meaning.definitions[0] && meaning.definitions[0].example) || "No example";
                const phonetic = entry.phonetic || "";

                return reply(
                    "📚 *" + entry.word + "* " + phonetic + "\n\n" +
                    "*Meaning:*\n" + definition + "\n\n" +
                    "*Example:*\n_" + example + "_"
                );
            } catch (e) {
                return reply("❌ Word not found.");
            }
        }

        // ==================== WIKI ====================
        if (cmd === "wiki") {
            if (!text) return reply("📖 Usage: #wiki <query>\nExample: #wiki Elon Musk");
            try {
                const { data } = await axios.get(
                    "https://en.wikipedia.org/api/rest_v1/page/summary/" + encodeURIComponent(text),
                    {
                        timeout: 12000,
                        headers: {
                            "User-Agent": "VENOM-X-Bot/1.0"
                        }
                    }
                );

                if (data.type === "disambiguation") {
                    return reply("⚠️ Too many results. Be more specific.\nExample: #wiki Cristiano Ronaldo");
                }

                if (!data.extract) {
                    return reply("❌ No Wikipedia page found.");
                }

                var summary = data.extract;
                if (summary.length > 700) summary = summary.slice(0, 700) + "...";

                var link = (data.content_urls && data.content_urls.desktop && data.content_urls.desktop.page) || "";

                return reply(
                    "📖 *" + data.title + "*\n\n" +
                    summary + "\n\n" +
                    (link ? "🔗 " + link : "")
                );
            } catch (e) {
                return reply("❌ No Wikipedia page found for that.");
            }
        }

        // ==================== CRYPTO ====================
        if (cmd === "crypto") {
            var coin = (args[0] || "bitcoin").toLowerCase();

            // common shortcuts
            if (coin === "btc") coin = "bitcoin";
            if (coin === "eth") coin = "ethereum";
            if (coin === "sol") coin = "solana";
            if (coin === "doge") coin = "dogecoin";
            if (coin === "bnb") coin = "binancecoin";
            if (coin === "xrp") coin = "ripple";
            if (coin === "ada") coin = "cardano";
            if (coin === "usdt") coin = "tether";

            try {
                const { data } = await axios.get(
                    "https://api.coingecko.com/api/v3/simple/price?ids=" + encodeURIComponent(coin) +
                    "&vs_currencies=usd,ngn&include_24hr_change=true",
                    { timeout: 12000 }
                );

                if (!data[coin]) {
                    return reply("❌ Coin not found.\nTry: bitcoin, ethereum, solana, dogecoin, bnb, xrp");
                }

                const price = data[coin];
                const change = price.usd_24h_change ? Number(price.usd_24h_change).toFixed(2) : "0.00";
                const emoji = Number(change) >= 0 ? "📈" : "📉";

                return reply(
                    "🪙 *" + coin.toUpperCase() + "*\n\n" +
                    "💵 USD: $" + Number(price.usd).toLocaleString() + "\n" +
                    "🇳🇬 NGN: ₦" + (price.ngn ? Number(price.ngn).toLocaleString() : "N/A") + "\n" +
                    emoji + " 24h: " + change + "%"
                );
            } catch (e) {
                return reply("❌ Failed to fetch crypto price. Try again later.");
            }
        }

        // ==================== CURRENCY ====================
        if (cmd === "currency") {
            if (args.length < 3) {
                return reply("💱 Usage: #currency <amount> <from> <to>\nExample: #currency 100 USD NGN");
            }

            const amount = parseFloat(args[0]);
            const fromCur = String(args[1] || "").toUpperCase();
            const toCur = String(args[2] || "").toUpperCase();

            if (isNaN(amount)) return reply("❌ Invalid amount.");

            try {
                const { data } = await axios.get(
                    "https://open.er-api.com/v6/latest/" + encodeURIComponent(fromCur),
                    { timeout: 12000 }
                );

                if (!data || !data.rates || !data.rates[toCur]) {
                    return reply("❌ Currency not supported.");
                }

                const result = (amount * data.rates[toCur]).toFixed(2);
                return reply(
                    "💱 *Currency Converter*\n\n" +
                    amount + " " + fromCur + " = *" + result + " " + toCur + "*"
                );
            } catch (e) {
                return reply("❌ Conversion failed.");
            }
        }

        // ==================== REMIND ====================
        if (cmd === "remind") {
            if (args.length < 2) {
                return reply("⏰ Usage: #remind <time> <message>\nExample: #remind 10m Call mom\n\nTime: 30s, 5m, 1h");
            }

            const timeArg = String(args[0]).toLowerCase();
            const remindMsg = args.slice(1).join(" ");
            var ms = 0;

            if (timeArg.endsWith("s")) ms = parseInt(timeArg, 10) * 1000;
            else if (timeArg.endsWith("m")) ms = parseInt(timeArg, 10) * 60 * 1000;
            else if (timeArg.endsWith("h")) ms = parseInt(timeArg, 10) * 60 * 60 * 1000;
            else return reply("❌ Invalid time. Use 30s, 5m, 1h");

            if (ms < 5000 || ms > 24 * 60 * 60 * 1000) {
                return reply("❌ Time must be between 5 seconds and 24 hours.");
            }

            await reply("⏰ Reminder set!\nI'll remind you in *" + timeArg + "*");

            setTimeout(async function () {
                await sock.sendMessage(from, {
                    text: "⏰ *Reminder*\n\n" + remindMsg,
                    mentions: [sender]
                }).catch(function () {});
            }, ms);

            return;
        }

        // ==================== SUMMARY ====================
        if (cmd === "summary") {
            if (!text || text.length < 30) {
                return reply("📝 Usage: #summary <long text>");
            }
            const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
            const summary = sentences.slice(0, 3).join(" ").slice(0, 400);
            return reply("📝 *Summary*\n\n" + summary + (text.length > 400 ? "..." : ""));
        }

        // ==================== REWRITE ====================
        if (cmd === "rewrite") {
            if (!text) return reply("✍️ Usage: #rewrite <text>");
            var rewritten = text
                .replace(/\bi\b/g, "I")
                .replace(/\bim\b/gi, "I'm")
                .replace(/\bdont\b/gi, "don't")
                .replace(/\bcant\b/gi, "can't")
                .replace(/\bwont\b/gi, "won't")
                .replace(/\bu\b/gi, "you")
                .replace(/\br\b/gi, "are");
            return reply("✍️ *Rewritten:*\n\n" + rewritten);
        }

        // ==================== BIO ====================
        if (cmd === "bio") {
            const bios = [
                "Creating my own path ✨",
                "Less talk, more action.",
                "Building in silence.",
                "Dream big. Work hard.",
                "Focused on growth.",
                "Writing my own story.",
                "Simple but effective.",
                "Energy speaks louder than words.",
                "On my own timeline.",
                "Quietly becoming dangerous.",
                "Main character energy.",
                "Still learning. Still evolving.",
                "Results over noise.",
                "Lowkey locked in.",
                "Different frequency."
            ];

            const chosen = [];
            while (chosen.length < 5) {
                const b = bios[Math.floor(Math.random() * bios.length)];
                if (chosen.indexOf(b) === -1) chosen.push(b);
            }

            return reply(
                "✍️ *Bio Ideas*\n\n" +
                "1. " + chosen[0] + "\n" +
                "2. " + chosen[1] + "\n" +
                "3. " + chosen[2] + "\n" +
                "4. " + chosen[3] + "\n" +
                "5. " + chosen[4]
            );
        }
    }
};
