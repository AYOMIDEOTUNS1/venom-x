const fs = require("fs");
const path = require("path");
const axios = require("axios");

const COOLDOWN_MS = 8000;
const lastUsed = new Map();

function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function checkCooldown(uid) {
    const now = Date.now();
    const prev = lastUsed.get(uid) || 0;
    const left = COOLDOWN_MS - (now - prev);
    if (left > 0) return Math.ceil(left / 1000);
    lastUsed.set(uid, now);
    return 0;
}

const TRUTHS = [
    "What is one secret you never told anyone?",
    "Who was your first crush?",
    "What is the most embarrassing thing on your phone?",
    "Have you ever lied to your best friend?",
    "What is something you regret doing?",
    "Who do you text first in the morning?",
    "What is your biggest fear?",
    "Have you ever stalked someone on social media?",
    "What is the last lie you told?",
    "Who in this chat would you trust with a secret?",
    "What habit are you trying to hide?",
    "What is the craziest dream you had?",
    "Have you ever cheated in an exam?",
    "What is one thing you would change about yourself?",
    "Who do you miss the most right now?",
    "What makes you insecure?",
    "Have you ever been in love?",
    "What is your guilty pleasure?",
    "Who was the last person you stalked online?",
    "What is the worst advice you ever got?",
    "Have you ever ghosted someone?",
    "What is your biggest flex?",
    "Who would you call at 3am?",
    "Have you ever been jealous of a friend?",
    "What secret could ruin you if exposed?",
    "Have you ever sent a text to the wrong person?",
    "What is your most embarrassing nickname?",
    "Have you ever broken a promise on purpose?",
    "What do you fake being good at?",
    "Who do you secretly envy?",
    "What’s the dumbest thing you’ve done for love?",
    "Have you ever cried because of a movie?",
    "What’s one thing you’re addicted to?",
    "Who was your worst kiss?",
    "Have you ever pretended to like a gift?",
    "What’s your biggest turn-off?",
    "Have you ever had a crush on a teacher?",
    "What’s the most childish thing you still do?",
    "Who do you think about before sleeping?",
    "Have you ever been caught stalking?",
    "What’s your biggest insecurity about your body?",
    "Have you ever liked a friend’s partner?",
    "What’s the biggest lie you’ve told your parents?",
    "Who in this group would you date?",
    "Have you ever screenshot a chat and shared it?",
    "What’s one thing you hope nobody finds out?",
    "Have you ever ignored a text on purpose for days?",
    "What’s your most toxic trait?",
    "Who was the last person you deep-stalked?"
];

const DARES = [
    "Send a funny voice note now.",
    "Change your status to something crazy for 10 minutes.",
    "Send a random emoji-only message.",
    "Type with your elbow for one message.",
    "Compliment the next person who chats.",
    "Send a tongue-twister in a voice note.",
    "Write a 1-line love poem in chat.",
    "Send 3 emojis that describe your mood.",
    "Call someone 'boss' in your next reply.",
    "Speak in a cartoon voice for one voice note.",
    "Send a voice note laughing for 5 seconds.",
    "Write your name backwards.",
    "Say the alphabet in a voice note as fast as you can.",
    "Send a motivational quote right now.",
    "Act like a news anchor in a voice note.",
    "Send a message using only 5 words.",
    "Write a roast about yourself.",
    "Describe your day using only emojis.",
    "Tell a bad dad joke right now.",
    "Send a riddle to the chat.",
    "Send a message in full CAPS only.",
    "Write a 2-line rap about WiFi.",
    "Act like a robot for one message.",
    "Name 3 things you can see right now.",
    "End your next message with a random emoji chain.",
    "Send a voice note saying 'I am the best' in a funny accent.",
    "Change your profile picture to something ugly for 5 minutes.",
    "Send a message without using the letter 'A'.",
    "Write a short story in 3 sentences about the last person who messaged you.",
    "Send a voice note singing the chorus of any song.",
    "Talk in third person for the next 3 messages.",
    "Send a screenshot of your battery percentage.",
    "Compliment yourself in the most dramatic way possible.",
    "Send a message using only song lyrics.",
    "Act like you’re a celebrity for one message.",
    "Send a voice note explaining how to cook noodles like it’s a cooking show.",
    "Write a break-up message to your pillow.",
    "Send 7 random emojis and make the group guess the meaning.",
    "Type your next message with your eyes closed.",
    "Send a motivational speech as if you’re a coach."
];

const ROASTS = [
    "Your network lags less than your replies.",
    "You bring joy… when you leave the chat.",
    "If laziness was a sport, you'd still come second.",
    "Your jokes need a loading screen.",
    "Even autocorrect is tired of your spelling.",
    "Your WiFi has better commitment than you.",
    "Your secrets are safe with me. I wasn't listening.",
    "Mirror called. It wants a break.",
    "Your brain has buffering issues.",
    "Even your shadow leaves you sometimes.",
    "You're proof that evolution can go in reverse.",
    "Your confidence is impressive for someone with your face.",
    "You have the personality of a damp towel.",
    "If stupidity was a currency, you'd be a billionaire.",
    "You're not ugly, you're just... creatively challenged.",
    "Your life is like a group project — someone else is doing all the work.",
    "You're the human version of a participation trophy.",
    "I'd agree with you but then we'd both be wrong.",
    "You're like a cloud. When you disappear, it's a beautiful day.",
    "Your family tree must be a cactus because everyone on it is a prick.",
    "You're the reason shampoo bottles have instructions.",
    "You're not completely useless... you can always serve as a bad example.",
    "Somewhere out there, a tree is working hard to produce oxygen for you. You owe it an apology.",
    "You're like a software update. Nobody wants you, but we're forced to deal with you.",
    "You're the human equivalent of a 404 error."
];

const COMPLIMENTS = [
    "You're stronger than you think.",
    "Your energy makes the chat better.",
    "You have good taste. Obviously.",
    "You're lowkey inspirational.",
    "You're the main character today.",
    "Keep going. You're built for this.",
    "You have a really calming presence.",
    "Your sense of humor is underrated.",
    "You make conversations interesting.",
    "You're smarter than you give yourself credit for.",
    "You have good vibes only.",
    "People are lucky to know you.",
    "You light up the chat without trying.",
    "You're doing better than you realize.",
    "Your kindness doesn't go unnoticed.",
    "You have a unique way of seeing things.",
    "You're more confident than you think.",
    "You make people feel comfortable.",
    "You're quietly powerful.",
    "You're one of the real ones."
];

const FLIRTS = [
    "Are you WiFi? Because I feel a connection.",
    "Is your name Google? Because you have everything I've been searching for.",
    "You must be tired, because you've been running through my mind all day.",
    "If beauty was time, you'd be eternity.",
    "Do you have a map? I just got lost in your eyes.",
    "Are you a magician? Because whenever I look at you, everyone else disappears.",
    "If you were a song, you'd be my favorite playlist.",
    "Are you made of copper and tellurium? Because you're Cu-Te.",
    "I must be a snowflake, because I've fallen for you.",
    "If looks could kill, you'd be a weapon of mass destruction.",
    "You're so beautiful that you made me forget my pickup line.",
    "Do you believe in love at first sight, or should I walk by again?",
    "If you were a vegetable, you'd be a cute-cumber.",
    "Are you a parking ticket? Because you've got 'FINE' written all over you.",
    "I'm not a photographer, but I can picture us together.",
    "If beauty were a crime, you'd be serving a life sentence.",
    "Is your dad a boxer? Because you're a knockout!",
    "I was wondering if you had an extra heart... mine seems to have been stolen.",
    "You must be a broom, because you just swept me off my feet."
];

// Better prompts for characters
const PROMPTS = {
    ronaldo: "Cristiano Ronaldo face portrait, realistic photo, high quality, sharp",
    itadori: "Yuji Itadori from Jujutsu Kaisen, anime style, detailed face, pink spiky hair, accurate",
    zuck: "Mark Zuckerberg portrait photo, realistic, high quality",
    elonmusk: "Elon Musk portrait photo, realistic, high quality",
    billgates: "Bill Gates portrait photo, realistic",
    justinbieber: "Justin Bieber portrait photo, realistic",
    donaldtrump: "Donald Trump portrait photo, realistic",
    joebiden: "Joe Biden portrait photo, realistic",
    therock: "Dwayne Johnson The Rock portrait photo, realistic",
    rihanna: "Rihanna portrait photo, realistic, beautiful",
    taylorswift: "Taylor Swift portrait photo, realistic",
    tomcruise: "Tom Cruise portrait photo, realistic",
    tomholland: "Tom Holland portrait photo, realistic",
    miakhalifa: "Mia Khalifa portrait photo",
    johnnysins: "Johnny Sins portrait photo",
    "tiktok-girl": "beautiful young woman, tiktok style, realistic photo, pretty face, high quality",
    "korean-girl": "beautiful korean girl, realistic photo, pretty face, high quality",
    "japan-girl": "beautiful japanese girl, realistic photo, pretty face",
    "china-girl": "beautiful chinese girl, realistic photo, pretty face",
    "hijab-girl": "beautiful girl wearing hijab, realistic photo, elegant",
    "random-girl": "beautiful young woman portrait, realistic photo, high quality",
    "indonesia-girl": "beautiful indonesian girl, realistic photo",
    "malaysia-girl": "beautiful malaysian girl, realistic photo",
    "thailand-girl": "beautiful thai girl, realistic photo",
    "vietnam-girl": "beautiful vietnamese girl, realistic photo",
    hentai: "anime girl, hentai style, detailed",
    moe: "cute anime girl, moe style, detailed eyes",
    sfw: "cute anime girl, safe for work, detailed",
    aipic: "beautiful anime girl, highly detailed, anime style"
};

const IMAGE_CMDS = [
    "ronaldo", "itadori", "zuck", "billgates", "elonmusk", "justinbieber", "donaldtrump", "joebiden",
    "johnnysins", "miakhalifa", "therock", "rihanna", "taylorswift", "tomcruise", "tomholland",
    "chinagirl", "bluearchive", "boypic", "carimage", "random-girl", "hijab-girl",
    "indonesia-girl", "japan-girl", "korean-girl", "malaysia-girl", "profile-pictures",
    "thailand-girl", "tiktok-girl", "vietnam-girl", "aipic", "hentai", "moe", "sfw", "dog", "meme"
];

const FUN_CMDS = IMAGE_CMDS.concat([
    "wouldyou", "flirt", "rate", "ship", "truthdare", "compliment", "roast", "joke", "truth", "dare",
    "advice", "inspire", "funfact", "fact", "dadjoke", "triviafact"
]);

function localCard(kind) {
    const base = path.join(__dirname, "..", "media", "fun");
    const jpg = path.join(base, kind + ".jpg");
    const png = path.join(base, kind + ".png");
    if (fs.existsSync(jpg) && fs.statSync(jpg).isFile()) return jpg;
    if (fs.existsSync(png) && fs.statSync(png).isFile()) return png;
    return null;
}

async function sendCard(sock, from, message, kind, text) {
    const local = localCard(kind);
    const caption =
        "╭━━〔 " + (kind === "truth" ? "🗣️ TRUTH" : "🔥 DARE") + " 〕━━⬣\n\n" +
        text +
        "\n\n⚡ VENOM X\n╰━━━━━━━━━━━━━━━━⬣";

    try {
        if (local) {
            await sock.sendMessage(from, {
                image: fs.readFileSync(local),
                caption: caption
            }, { quoted: message });
            return;
        }
        await sock.sendMessage(from, { text: caption }, { quoted: message });
    } catch (e) {
        await sock.sendMessage(from, { text: caption }, { quoted: message }).catch(() => {});
    }
}

function getImageFetch() {
    const p = path.join(__dirname, "..", "lib", "imageFetch.js");
    try {
        delete require.cache[require.resolve(p)];
    } catch (e) {}
    return require(p);
}

module.exports = {
    name: "fun",
    aliases: FUN_CMDS,

    run: async function ({ sock, from, commandName, reply, message, sender }) {
        const cmd = String(commandName || "fun").toLowerCase();
        const uid = String(sender || from || "user");

        const wait = checkCooldown(uid);
        if (wait > 0) return reply("⏳ Cool down: " + wait + "s");

        if (cmd === "truth") return sendCard(sock, from, message, "truth", pick(TRUTHS));
        if (cmd === "dare") return sendCard(sock, from, message, "dare", pick(DARES));
        if (cmd === "truthdare") {
            return Math.random() > 0.5
                ? sendCard(sock, from, message, "truth", pick(TRUTHS))
                : sendCard(sock, from, message, "dare", pick(DARES));
        }

        if (cmd === "roast") return reply("🔥 " + pick(ROASTS));
        if (cmd === "compliment") return reply("✨ " + pick(COMPLIMENTS));
        if (cmd === "flirt") return reply("😉 " + pick(FLIRTS));
        if (cmd === "advice" || cmd === "inspire") return reply("💡 Stay consistent. Small steps win.");
        if (cmd === "wouldyou") return reply("🤔 Would you rather be rich without love, or loved without money?");
        if (cmd === "rate") return reply("📊 Rate: " + Math.floor(Math.random() * 101) + "/100");
        if (cmd === "ship") return reply("💘 Ship: " + Math.floor(Math.random() * 101) + "%");

        if (cmd === "fun") {
            const m = pick(["truth", "dare", "roast", "compliment", "flirt", "rate", "ship"]);
            if (m === "truth") return sendCard(sock, from, message, "truth", pick(TRUTHS));
            if (m === "dare") return sendCard(sock, from, message, "dare", pick(DARES));
            if (m === "roast") return reply("🔥 " + pick(ROASTS));
            if (m === "compliment") return reply("✨ " + pick(COMPLIMENTS));
            if (m === "flirt") return reply("😉 " + pick(FLIRTS));
            if (m === "rate") return reply("📊 Rate: " + Math.floor(Math.random() * 101) + "/100");
            return reply("💘 Ship: " + Math.floor(Math.random() * 101) + "%");
        }

        if (cmd === "joke" || cmd === "dadjoke") {
            try {
                const r = await axios.get("https://official-joke-api.appspot.com/random_joke", { timeout: 8000 });
                return reply("😂 " + r.data.setup + "\n\n" + r.data.punchline);
            } catch (e) {
                return reply("😂 Why do programmers prefer dark mode? Light attracts bugs.");
            }
        }

        if (cmd === "fact" || cmd === "funfact" || cmd === "triviafact") {
            try {
                const r = await axios.get("https://uselessfacts.jsph.pl/api/v2/facts/random", { timeout: 8000 });
                return reply("🧠 " + r.data.text);
            } catch (e) {
                return reply("🧠 Honey never spoils.");
            }
        }

        // ========== IMAGE COMMANDS ==========
        if (IMAGE_CMDS.includes(cmd)) {
            await reply(`✨ Loading *${cmd}*...`);

            try {
                const { getImageBuffer } = getImageFetch();

                if (cmd === "dog") {
                    const buf = await getImageBuffer({ dog: true });
                    await sock.sendMessage(from, {
                        image: buf,
                        caption: `😝 *dog*\n⚡ VENOM X`
                    }, { quoted: message });
                    return;
                }

                const prompt = PROMPTS[cmd] || (cmd.replace(/-/g, " ") + " portrait, high quality");

                const buf = await getImageBuffer({
                    prompt: prompt,
                    nekoType: ["hentai", "moe", "sfw", "aipic"].includes(cmd) ? (cmd === "hentai" ? "hentai" : "neko") : null
                });

                await sock.sendMessage(from, {
                    image: buf,
                    caption: `😝 *${cmd}*\n⚡ VENOM X`
                }, { quoted: message });

            } catch (err) {
                return reply(`❌ Image failed:\n${err.message}`);
            }
            return;
        }

        return reply("🎲 Try: #truth #dare #roast #fun #itadori #ronaldo");
    }
};
