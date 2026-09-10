/**
 * Mature & Useful Commands
 * #define #wiki #news #crypto #currency #remind #summary #rewrite #bio
 */

const axios = require("axios");

// Simple in-memory reminders
const reminders = new Map();

module.exports = {
    name: "mature",
    aliases: ["define", "wiki", "news", "crypto", "currency", "remind", "summary", "rewrite", "bio"],

    run: async ({ sock, from, args, reply, message, sender, commandName }) => {
        const cmd = commandName.toLowerCase();
        const text = args.join(" ").trim();

        // ==================== DEFINE ====================
        if (cmd === "define") {
            if (!text) return reply("📚 Usage: #define <word>");
            try {
                const { data } = await axios.get(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(text)}`, { timeout: 10000 });
                const entry = data[0];
                const meaning = entry.meanings[0];
                const definition = meaning.definitions[0].definition;
                const example = meaning.definitions[0].example || "No example available";
                const phonetic = entry.phonetic || "";

                return reply(`📚 *${entry.word}* \( {phonetic}\n\n*Meaning:*\n \){definition}\n\n*Example:*\n_${example}_`);
            } catch {
                return reply("❌ Word not found.");
            }
        }

        // ==================== WIKI ====================
        if (cmd === "wiki") {
            if (!text) return reply("📖 Usage: #wiki <query>");
            try {
                const { data } = await axios.get(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(text)}`, { timeout: 10000 });
                if (data.type === "disambiguation") return reply("⚠️ Too many results. Please be more specific.");
                
                const summary = data.extract.length > 700 ? data.extract.slice(0, 700) + "..." : data.extract;
                return reply(`📖 *\( {data.title}*\n\n \){summary}\n\n🔗 ${data.content_urls?.desktop?.page || ""}`);
            } catch {
                return reply("❌ No Wikipedia page found.");
            }
        }

        // ==================== NEWS ====================
        if (cmd === "news") {
            try {
                const { data } = await axios.get("https://saasworks.xyz/api/v1/news?limit=5", { timeout: 10000 }).catch(() => null);
                
                // Fallback to another source
                const res = await axios.get("https://newsdata.io/api/1/news?apikey=pub_YOURKEY&language=en&category=top", { timeout: 10000 }).catch(() => null);
                
                return reply(`📰 *Top News*\n\nSorry, news API is currently limited.\nYou can use:\n#wiki <topic>\ninstead for information.`);
            } catch {
                return reply("📰 News service is temporarily unavailable.");
            }
        }

        // ==================== CRYPTO ====================
        if (cmd === "crypto") {
            const coin = (args[0] || "bitcoin").toLowerCase();
            try {
                const { data } = await axios.get(`https://api.coingecko.com/api/v3/simple/price?ids=${coin}&vs_currencies=usd,ngn&include_24hr_change=true`, { timeout: 10000 });
                
                if (!data[coin]) return reply("❌ Coin not found. Try: bitcoin, ethereum, solana, dogecoin");

                const price = data[coin];
                const change = price.usd_24h_change?.toFixed(2) || 0;
                const emoji = change >= 0 ? "📈" : "📉";

                return reply(`🪙 *${coin.toUpperCase()}*\n\n💵 USD: $${price.usd.toLocaleString()}\n🇳🇬 NGN: ₦\( {price.ngn?.toLocaleString() || "N/A"}\n \){emoji} 24h: ${change}%`);
            } catch {
                return reply("❌ Failed to fetch crypto price.");
            }
        }

        // ==================== CURRENCY ====================
        if (cmd === "currency") {
            if (args.length < 3) return reply("💱 Usage: #currency <amount> <from> <to>\nExample: #currency 100 USD NGN");
            
            const amount = parseFloat(args[0]);
            const fromCur = args[1].toUpperCase();
            const toCur = args[2].toUpperCase();

            if (isNaN(amount)) return reply("❌ Invalid amount.");

            try {
                const { data } = await axios.get(`https://open.er-api.com/v6/latest/${fromCur}`, { timeout: 10000 });
                if (!data.rates[toCur]) return reply("❌ Currency not supported.");

                const result = (amount * data.rates[toCur]).toFixed(2);
                return reply(`💱 *Currency Converter*\n\n${amount} \( {fromCur} = * \){result} ${toCur}*`);
            } catch {
                return reply("❌ Conversion failed.");
            }
        }

        // ==================== REMIND ====================
        if (cmd === "remind") {
            if (args.length < 2) return reply("⏰ Usage: #remind <time> <message>\nExample: #remind 10m Call mom\n\nTime: 30s, 5m, 1h, 2h");

            const timeArg = args[0].toLowerCase();
            const remindMsg = args.slice(1).join(" ");
            let ms = 0;

            if (timeArg.endsWith("s")) ms = parseInt(timeArg) * 1000;
            else if (timeArg.endsWith("m")) ms = parseInt(timeArg) * 60 * 1000;
            else if (timeArg.endsWith("h")) ms = parseInt(timeArg) * 60 * 60 * 1000;
            else return reply("❌ Invalid time format. Use 30s, 5m, 1h etc.");

            if (ms < 5000 || ms > 24 * 60 * 60 * 1000) return reply("❌ Time must be between 5 seconds and 24 hours.");

            await reply(`⏰ Reminder set!\nI'll remind you in *${timeArg}*`);

            setTimeout(async () => {
                await sock.sendMessage(from, {
                    text: `⏰ *Reminder*\n\n${remindMsg}`,
                    mentions: [sender]
                }).catch(() => {});
            }, ms);

            return;
        }

        // ==================== SUMMARY ====================
        if (cmd === "summary") {
            if (!text || text.length < 30) return reply("📝 Usage: #summary <long text>\nOr reply to a long message with #summary");
            
            // Basic extractive summary (first few sentences + length limit)
            const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
            const summary = sentences.slice(0, 3).join(" ").slice(0, 400);
            return reply(`📝 *Summary*\n\n\( {summary} \){text.length > 400 ? "..." : ""}`);
        }

        // ==================== REWRITE ====================
        if (cmd === "rewrite") {
            if (!text) return reply("✍️ Usage: #rewrite <text>\nMakes your text sound better.");
            
            // Simple improvements
            let rewritten = text
                .replace(/\bi\b/g, "I")
                .replace(/\bim\b/gi, "I'm")
                .replace(/\bdont\b/gi, "don't")
                .replace(/\bcant\b/gi, "can't")
                .replace(/\bwont\b/gi, "won't")
                .replace(/\bu\b/gi, "you")
                .replace(/\br\b/gi, "are");

            return reply(`✍️ *Rewritten:*\n\n${rewritten}`);
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
                if (!chosen.includes(b)) chosen.push(b);
            }

            return reply(`✍️ *Bio Ideas*\n\n1. ${chosen[0]}\n2. ${chosen[1]}\n3. ${chosen[2]}\n4. ${chosen[3]}\n5. ${chosen[4]}`);
        }
    }
};
