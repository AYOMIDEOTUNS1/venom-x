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
    "You bring everyone so much joy… when you leave the room.",
    "Some people are like clouds. Mixed up and hard to understand.",
    "You're the human version of a participation trophy.",
    "Your brain is like the Bermuda Triangle — information goes in and is never found again.",
    "I'd explain it to you but I left my crayons at home.",
    "You're about as useful as a screen door on a submarine.",
    "You have the perfect face for radio.",
    "If you were any more dense we'd have to bury you.",
    "You're the reason aliens won't talk to us.",
    "Somewhere out there, a tree is producing oxygen for you. You owe it an apology.",
    "You're like a software update. Nobody wants you, but we're stuck with you.",
    "You have the charisma of a wet sock.",
    "If laughter is the best medicine, your face is a cure for boredom."
];

const quotes = [
    "The only way to do great work is to love what you do. – Steve Jobs",
    "In the middle of every difficulty lies opportunity. – Albert Einstein",
    "Success is not final, failure is not fatal. – Winston Churchill",
    "Believe you can and you're halfway there. – Theodore Roosevelt",
    "Do what you can, with what you have, where you are. – Theodore Roosevelt",
    "Everything you’ve ever wanted is on the other side of fear. – George Addair",
    "Dream big and dare to fail. – Norman Vaughan",
    "It always seems impossible until it’s done. – Nelson Mandela",
    "Hardships often prepare ordinary people for an extraordinary destiny. – C.S. Lewis",
    "The future belongs to those who believe in the beauty of their dreams. – Eleanor Roosevelt",
    "Don’t watch the clock; do what it does. Keep going. – Sam Levenson",
    "You are never too old to set another goal or to dream a new dream. – C.S. Lewis",
    "Try not to become a person of success, but rather try to become a person of value. – Albert Einstein",
    "What you get by achieving your goals is not as important as what you become by achieving your goals. – Zig Ziglar",
    "The only limit to our realization of tomorrow is our doubts of today. – Franklin D. Roosevelt"
];

const animeQuotes = [
    // General Anime
    "「 People die when they are killed. 」 – Shirou Emiya",
    "「 The world isn’t perfect. But it’s there for us, trying the best it can. 」 – Roy Mustang",
    "「 If you don’t take risks, you can’t create a future. 」 – Monkey D. Luffy",
    "「 Whatever you lose, you’ll find it again. But what you throw away you’ll never get back. 」 – Kenshin Himura",
    "「 A lesson without pain is meaningless. 」 – Edward Elric",
    "「 The only thing we’re allowed to believe is that we won’t regret the choice we made. 」 – Levi Ackerman",
    "「 You should enjoy the little detours. Because that's where you'll find the things more important than what you want. 」 – Ging Freecss",
    "「 Power comes in response to a need, not a desire. 」 – Goku",
    "「 A pupil should surpass their teacher. 」 – Kakashi Hatake",
    "「 Those who cannot acknowledge themselves will eventually fail. 」 – Itachi Uchiha",

    // Jujutsu Kaisen
    "「 Throughout Heaven and Earth, I alone am the honored one. 」 – Satoru Gojo",
    "「 I don't want to regret the way I live. 」 – Yuji Itadori",
    "「 The only thing left behind is the results. 」 – Kento Nanami",
    "「 You’re not alone. 」 – Yuji Itadori",
    "「 I am you. 」 – Sukuna",
    "「 Being a jujutsu sorcerer is a thankless job. 」 – Kento Nanami",
    "「 I’ll save people. That’s enough for me. 」 – Yuji Itadori",
    "「 Don’t ever forget that I am the strongest. 」 – Satoru Gojo",
    "「 A world that you can change is a world that you can also destroy. 」 – Suguru Geto",
    "「 Dying is easy. Living is harder. 」 – Yuji Itadori",
    "「 I’m not a hero. I’m a jujutsu sorcerer. 」 – Yuji Itadori",
    "「 When you die, you die alone. 」 – Suguru Geto",
    "「 Let’s enjoy this. 」 – Toji Fushiguro",
    "「 Strength is the only thing that allows you to protect someone. 」 – Toji Fushiguro",
    "「 I want to be needed by someone. 」 – Yuuta Okkotsu",
    "「 I’m just a cog. 」 – Kento Nanami",
    "「 Are you the strongest because you’re Satoru Gojo? Or are you Satoru Gojo because you’re the strongest? 」 – Suguru Geto"
];

const riddles = [
    { q: "What has keys but can't open locks?", a: "A piano" },
    { q: "What has hands but can’t clap?", a: "A clock" },
    { q: "What can travel around the world while staying in a corner?", a: "A stamp" },
    { q: "What has a head and a tail but no body?", a: "A coin" },
    { q: "What gets wetter the more it dries?", a: "A towel" },
    { q: "I’m tall when I’m young, and short when I’m old. What am I?", a: "A candle" },
    { q: "What has many teeth but can’t bite?", a: "A comb" },
    { q: "What can you catch but not throw?", a: "A cold" },
    { q: "What goes up but never comes down?", a: "Your age" },
    { q: "What has a neck but no head?", a: "A bottle" },
    { q: "What is full of holes but still holds water?", a: "A sponge" },
    { q: "What has space but no room?", a: "A keyboard" },
    { q: "What can you break without touching it?", a: "A promise" },
    { q: "What has one eye but can’t see?", a: "A needle" },
    { q: "What comes once in a minute, twice in a moment, but never in a thousand years?", a: "The letter M" }
];

module.exports = {
    name: "funextra",
    aliases: ["quote", "ship", "insult", "pick", "couple", "riddle", "quoteanime", "meme", "wallpaper", "character"],

    run: async ({ sock, from, args, reply, message, isGroup, sender }) => {
        const body = message.message?.conversation || 
                     message.message?.extendedTextMessage?.text || "";
        const cmd = body.slice(1).split(" ")[0].toLowerCase().trim();

        // QUOTE
        if (cmd === "quote") {
            return reply(`💫 *Quote*\n\n"${pick(quotes)}"`);
        }

        // ANIME QUOTE
        if (cmd === "quoteanime") {
            return reply(`🎌 *Anime Quote*\n\n${pick(animeQuotes)}`);
        }

        // INSULT
        if (cmd === "insult") {
            return reply(`😈 ${pick(insults)}`);
        }

        // RIDDLE
        if (cmd === "riddle") {
            const r = pick(riddles);
            await reply(`🧩 *Riddle*\n\n${r.q}\n\n_Answer will be revealed in 15 seconds..._`);
            setTimeout(() => {
                sock.sendMessage(from, { text: `✅ *Answer:* ${r.a}` }, { quoted: message }).catch(() => {});
            }, 15000);
            return;
        }

        // SHIP
        if (cmd === "ship") {
            let users = message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
            if (users.length < 2) {
                return reply("💖 Tag two users\nExample: #ship @user1 @user2");
            }
            const percent = Math.floor(Math.random() * 101);
            let comment = percent >= 85 ? "Perfect match! 💕" :
                          percent >= 70 ? "Really good chemistry 🔥" :
                          percent >= 50 ? "There's potential 😏" :
                          percent >= 30 ? "Just friends... maybe 😅" : "Stay away from each other 💀";
            return reply(`💘 *Ship Result*\n\n@\( {users[0].split("@")[0]} ❤️ @ \){users[1].split("@")[0]}\n\n*Compatibility: \( {percent}%*\n \){comment}`, {
                mentions: users
            });
        }

        // PICK
        if (cmd === "pick") {
            if (!isGroup) return reply("❌ Group only.");
            const meta = await sock.groupMetadata(from);
            const members = meta.participants.map(p => p.id);
            const chosen = pick(members);
            return reply(`🎯 *I pick*\n\n@${chosen.split("@")[0]}`, {
                mentions: [chosen]
            });
        }

        // COUPLE
        if (cmd === "couple") {
            if (!isGroup) return reply("❌ Group only.");
            const meta = await sock.groupMetadata(from);
            const members = meta.participants.map(p => p.id);
            if (members.length < 2) return reply("Not enough members.");
            let a = pick(members);
            let b = pick(members);
            while (a === b) b = pick(members);
            return reply(`💑 *Couple of the Day*\n\n@\( {a.split("@")[0]} ❤️ @ \){b.split("@")[0]}\n\nCongratulations 💕`, {
                mentions: [a, b]
            });
        }

        // MEME
        if (cmd === "meme") {
            try {
                const { data } = await axios.get("https://meme-api.com/gimme", { timeout: 10000 });
                await sock.sendMessage(from, {
                    image: { url: data.url },
                    caption: `😂 *${data.title}*\n👍 ${data.ups} upvotes`
                }, { quoted: message });
            } catch {
                reply("❌ Failed to fetch meme.");
            }
            return;
        }

        // WALLPAPER
        if (cmd === "wallpaper") {
            try {
                const res = await axios.get("https://api.waifu.im/search?included_tags=waifu&is_nsfw=false", { timeout: 10000 });
                const url = res.data.images?.[0]?.url;
                if (!url) throw new Error("No image");
                await sock.sendMessage(from, {
                    image: { url },
                    caption: "🖼️ Random Wallpaper"
                }, { quoted: message });
            } catch {
                reply("❌ Failed to get wallpaper.");
            }
            return;
        }

        // CHARACTER
        if (cmd === "character") {
            try {
                const res = await axios.get("https://api.waifu.im/search?included_tags=waifu&is_nsfw=false", { timeout: 10000 });
                const img = res.data.images?.[0];
                await sock.sendMessage(from, {
                    image: { url: img.url },
                    caption: `🎌 *Anime Character*`
                }, { quoted: message });
            } catch {
                reply("❌ Failed to fetch character.");
            }
        }
    }
};
