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
    "Who do you secretly envy?"
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
    "End your next message with a random emoji chain."
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
    "Even your shadow leaves you sometimes."
];

const COMPLIMENTS = [
    "You're stronger than you think.",
    "Your energy makes the chat better.",
    "You have good taste. Obviously.",
    "You're lowkey inspirational.",
    "You're the main character today.",
    "Keep going. You're built for this."
];

const FLIRTS = [
    "Are you WiFi? Because I feel a connection.",
    "Is your name Google? Because you have everything I've been searching for.",
    "You must be tired, because you've been running through my mind all day.",
    "If beauty was time, you'd be eternity."
];

const IMAGE_CMDS = [
    "ronaldo", "zuck", "billgates", "elonmusk", "justinbieber", "donaldtrump", "joebiden",
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
        await sock.sendMessage(from, { text: caption }, { quoted: message }).catch(function () {});
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

        // IMAGE COMMANDS
        if (IMAGE_CMDS.indexOf(cmd) !== -1) {
            await reply("✨ Loading " + cmd + "...");
            try {
                const { getImageBuffer } = getImageFetch();

                if (cmd === "dog") {
                    const buf = await getImageBuffer({ dog: true });
                    await sock.sendMessage(from, {
                        image: buf,
                        caption: "😝 dog\n⚡ VENOM X"
                    }, { quoted: message });
                    return;
                }

                let prompt = cmd.replace(/-/g, " ");
                if (cmd === "tiktok-girl") prompt = "beautiful young woman portrait photo";
                if (cmd === "ronaldo") prompt = "cristiano ronaldo portrait photo";
                if (cmd === "zuck") prompt = "mark zuckerberg portrait photo";
                if (cmd === "elonmusk") prompt = "elon musk portrait photo";
                if (cmd === "miakhalifa") prompt = "mia khalifa portrait photo";
                if (cmd === "hentai") prompt = "anime girl anime style";
                if (cmd === "moe" || cmd === "sfw" || cmd === "aipic") prompt = "cute anime girl";

                const buf = await getImageBuffer({
                    prompt: prompt,
                    nekoType: cmd === "hentai" ? "hentai" : "neko"
                });

                await sock.sendMessage(from, {
                    image: buf,
                    caption: "😝 " + cmd + "\n⚡ VENOM X"
                }, { quoted: message });
            } catch (err) {
                return reply("❌ Image failed:\n" + err.message);
            }
            return;
        }

        return reply("🎲 Try: #truth #dare #roast #fun #tiktok-girl");
    }
};
