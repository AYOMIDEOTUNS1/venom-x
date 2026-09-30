function mapText(text, map) {
    return String(text).split("").map(function (ch) {
        const lower = ch.toLowerCase();
        return map[lower] !== undefined ? map[lower] : ch;
    }).join("");
}

const STYLES = {
    bold: {"a":"𝗮","b":"𝗯","c":"𝗰","d":"𝗱","e":"𝗲","f":"𝗳","g":"𝗴","h":"𝗵","i":"𝗶","j":"𝗷","k":"𝗸","l":"𝗹","m":"𝗺","n":"𝗻","o":"𝗼","p":"𝗽","q":"𝗾","r":"𝗿","s":"𝘀","t":"𝘁","u":"𝘂","v":"𝘃","w":"𝘄","x":"𝘅","y":"𝘆","z":"𝘇"},
    script: {"a":"𝓪","b":"𝓫","c":"𝓬","d":"𝓭","e":"𝓮","f":"𝓯","g":"𝓰","h":"𝓱","i":"𝓲","j":"𝓳","k":"𝓴","l":"𝓵","m":"𝓶","n":"𝓷","o":"𝓸","p":"𝓹","q":"𝓺","r":"𝓻","s":"𝓼","t":"𝓽","u":"𝓾","v":"𝓿","w":"𝔀","x":"𝔁","y":"𝔂","z":"𝔃"},
    bubbled: {"a":"ⓐ","b":"ⓑ","c":"ⓒ","d":"ⓓ","e":"ⓔ","f":"ⓕ","g":"ⓖ","h":"ⓗ","i":"ⓘ","j":"ⓙ","k":"ⓚ","l":"ⓛ","m":"ⓜ","n":"ⓝ","o":"ⓞ","p":"ⓟ","q":"ⓠ","r":"ⓡ","s":"ⓢ","t":"ⓣ","u":"ⓤ","v":"ⓥ","w":"ⓦ","x":"ⓧ","y":"ⓨ","z":"ⓩ"}
};

module.exports = {
    name: "style",
    aliases: ["fancy", "fonts"],

    run: async function ({ args, reply }) {
        const text = args.join(" ").trim();
        if (!text) return reply("Usage:\n#style venom x");

        return reply(
"✨ *VENOM STYLES*\n\n" +
"𝗕𝗼𝗹𝗱: " + mapText(text, STYLES.bold) + "\n" +
"𝒮𝒸𝓇𝒾𝓅𝓉: " + mapText(text, STYLES.script) + "\n" +
"Ⓑⓤⓑⓑⓛⓔ: " + mapText(text, STYLES.bubbled)
        );
    }
};
