const axios = require("axios");

function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

const insults = [
    "You're like a cloud. When you disappear, it's a beautiful day.",
    "I'd agree with you but then we'd both be wrong.",
    "You're the reason the gene pool needs a lifeguard.",
    "Your secrets are safe with me. I wasn't even listening.",
    "You're proof that evolution can go in reverse.",
    "If I wanted to kill myself, I'd climb your ego and jump to your IQ.",
    "You're not stupid — you just have bad luck thinking.",
    "You bring everyone so much joy when you leave the room.",
    "You're the human version of a participation trophy.",
    "Your brain is like the Bermuda Triangle — information goes in and is never found again.",
    "I'd explain it to you but I left my crayons at home.",
    "You're about as useful as a screen door on a submarine.",
    "You have the perfect face for radio.",
    "You're the reason aliens won't talk to us.",
    "You're like a software update. Nobody wants you, but we're stuck with you.",
    "You have the charisma of a wet sock."
];

const quotes = [
    "The only way to do great work is to love what you do. – Steve Jobs",
    "In the middle of every difficulty lies opportunity. – Albert Einstein",
    "Success is not final, failure is not fatal. – Winston Churchill",
    "Believe you can and you're halfway there. – Theodore Roosevelt",
    "It always seems impossible until it’s done. – Nelson Mandela",
    "Hardships often prepare ordinary people for an extraordinary destiny. – C.S. Lewis",
    "Don’t watch the clock; do what it does. Keep going. – Sam Levenson",
    "The only limit to our realization of tomorrow is our doubts of today. – Franklin D. Roosevelt"
];

const animeQuotes = [
    "Throughout Heaven and Earth, I alone am the honored one. – Satoru Gojo",
    "I don't want to regret the way I live. – Yuji Itadori",
    "The only thing left behind is the results. – Kento Nanami",
    "I am you. – Sukuna",
    "Don't ever forget that I am the strongest. – Satoru Gojo",
    "Dying is easy. Living is harder. – Yuji Itadori",
    "Let's enjoy this. – Toji Fushiguro",
    "Are you the strongest because you're Satoru Gojo? Or are you Satoru Gojo because you're the strongest? – Suguru Geto",
    "If you don't take risks, you can't create a future. – Monkey D. Luffy",
    "A lesson without pain is meaningless. – Edward Elric",
    "The only thing we're allowed to believe is that we won't regret the choice we made. – Levi Ackerman"
];

const riddles = [
    { q: "What has keys but can't open locks?", a: "A piano" },
    { q: "What has hands but can't clap?", a: "A clock" },
    { q: "What can travel around the world while staying in a corner?", a: "A stamp" },
    { q: "What has a head and a tail but no body?", a: "A coin" },
    { q: "What gets wetter the more it dries?", a: "A towel" },
    { q: "I'm tall when I'm young, and short when I'm old. What am I?", a: "A candle" },
    { q: "What has many teeth but can't bite?", a: "A comb" },
    { q: "What can you catch but not throw?", a: "A cold" },
    { q: "What goes up but never comes down?", a: "Your age" },
    { q: "What has a neck but no head?", a: "A bottle" }
];

function tag(jid) {
    return "@" + String(jid || "").split("@")[0];
}

module.exports = {
    name: "funextra",
    aliases: ["quote", "ship", "insult", "pick", "couple", "riddle", "quoteanime", "meme", "wallpaper", "character"],

    run: async function ({ sock, from, reply, message, isGroup }) {
        const body = (message.message && message.message.conversation) ||
                     (message.message && message.message.extendedTextMessage && message.message.extendedTextMessage.text) || "";
        const cmd = body.replace(/^[#./!]/, "").split(" ")[0].toLowerCase().trim();

        if (cmd === "quote") {
            return reply("💫 *Quote*\n\n\"" + pick(quotes) + "\"");
        }

        if (cmd === "quoteanime") {
            return reply("🎌 *Anime Quote*\n\n" + pick(animeQuotes));
        }

        if (cmd === "insult") {
            return reply("😈 " + pick(insults));
        }

        if (cmd === "riddle") {
            const r = pick(riddles);
            await reply("🧩 *Riddle*\n\n" + r.q + "\n\n_Answer will be revealed in 15 seconds..._");
            setTimeout(function () {
                sock.sendMessage(from, { text: "✅ *Answer:* " + r.a }, { quoted: message }).catch(function () {});
            }, 15000);
            return;
        }

        if (cmd === "ship") {
            const users = (message.message &&
                message.message.extendedTextMessage &&
                message.message.extendedTextMessage.contextInfo &&
                message.message.extendedTextMessage.contextInfo.mentionedJid) || [];

            if (users.length < 2) {
                return reply("💖 Tag two users\nExample: #ship @user1 @user2");
            }

            const percent = Math.floor(Math.random() * 101);
            let comment = "Stay away from each other 💀";
            if (percent >= 85) comment = "Perfect match! 💕";
            else if (percent >= 70) comment = "Really good chemistry 🔥";
            else if (percent >= 50) comment = "There's potential 😏";
            else if (percent >= 30) comment = "Just friends... maybe 😅";

            return sock.sendMessage(from, {
                text: "💘 *Ship Result*\n\n" + tag(users[0]) + " ❤️ " + tag(users[1]) + "\n\n*Compatibility: " + percent + "%*\n" + comment,
                mentions: users
            }, { quoted: message });
        }

        if (cmd === "pick") {
            if (!isGroup) return reply("❌ Group only.");
            const meta = await sock.groupMetadata(from);
            const members = meta.participants.map(function (p) { return p.id; });
            const chosen = pick(members);
            return sock.sendMessage(from, {
                text: "🎯 *I pick*\n\n" + tag(chosen),
                mentions: [chosen]
            }, { quoted: message });
        }

        if (cmd === "couple") {
            if (!isGroup) return reply("❌ Group only.");
            const meta = await sock.groupMetadata(from);
            const members = meta.participants.map(function (p) { return p.id; });
            if (members.length < 2) return reply("Not enough members.");

            var a = pick(members);
            var b = pick(members);
            while (a === b) b = pick(members);

            return sock.sendMessage(from, {
                text: "💑 *Couple of the Day*\n\n" + tag(a) + " ❤️ " + tag(b) + "\n\nCongratulations 💕",
                mentions: [a, b]
            }, { quoted: message });
        }

        if (cmd === "meme") {
            try {
                const res = await axios.get("https://meme-api.com/gimme", { timeout: 10000 });
                await sock.sendMessage(from, {
                    image: { url: res.data.url },
                    caption: "😂 *" + res.data.title + "*\n👍 " + res.data.ups + " upvotes"
                }, { quoted: message });
            } catch {
                reply("❌ Failed to fetch meme.");
            }
            return;
        }

        if (cmd === "wallpaper" || cmd === "character") {
            try {
                const res = await axios.get("https://api.waifu.im/search?included_tags=waifu&is_nsfw=false", { timeout: 10000 });
                const url = res.data.images && res.data.images[0] && res.data.images[0].url;
                if (!url) throw new Error("No image");
                await sock.sendMessage(from, {
                    image: { url: url },
                    caption: cmd === "character" ? "🎌 *Anime Character*" : "🖼️ Random Wallpaper"
                }, { quoted: message });
            } catch {
                reply("❌ Failed to get image.");
            }
        }
    }
};
