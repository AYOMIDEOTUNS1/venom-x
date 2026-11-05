"use strict";

const axios = require("axios");
const {
    STARTERS,
    getUser,
    setUser,
    ensureList,
    getSpecies,
    spriteUrl,
    makeMon,
    stars,
    dexCount
} = require("../lib/pokemon");
const { getSettings } = require("../lib/settingsCache");

function px() {
    try {
        return getSettings().prefix || "#";
    } catch (e) {
        return "#";
    }
}

async function sendArt(sock, from, message, species, caption, shiny) {
    const url =
        (!shiny && species.sprite) ||
        spriteUrl(species.id, shiny);
    try {
        const res = await axios.get(url, {
            responseType: "arraybuffer",
            timeout: 25000,
            headers: { "User-Agent": "VENOM-X" },
            validateStatus: function (s) {
                return s >= 200 && s < 400;
            }
        });
        const buf = Buffer.from(res.data || []);
        if (buf.length > 800) {
            await sock.sendMessage(
                from,
                { image: buf, caption: caption },
                { quoted: message }
            );
            return;
        }
    } catch (e) {
        console.log("poke img:", e.message);
    }
    await sock.sendMessage(from, { text: caption }, { quoted: message });
}

function help(p, count) {
    return (
`╭━━〔 ⚔️ VENOM POKÉMON 〕━━⬣
┃
┃ Dex species: *${count || "1000+"}*
┃ (full National Dex via PokeAPI)
┃
┃ ${p}pokemon start
┃ ${p}pokemon starter <bulbasaur|charmander|squirtle>
┃ ${p}team
┃ ${p}pokedex <name|id>
┃ ${p}pokemon init   — refresh dex cache (owner)
┃
┃ Each catch later = 1 card
┃ Max species ≈ 1025+
╰━━━━━━━━━━━━━━━━⬣`
    );
}

module.exports = {
    name: "pokemon",
    aliases: ["poke", "pk", "pokedex", "team", "poketeam"],

    run: async function ({
        sock,
        from,
        sender,
        args,
        reply,
        message,
        commandName,
        isOwner
    }) {
        const p = px();
        const cmd = String(commandName || "pokemon").toLowerCase();
        const sub = String((args && args[0]) || "").toLowerCase();
        const rest = (args || []).slice(1).join(" ").trim();

        // warm cache in background when used
        try {
            await ensureList();
        } catch (e) {
            console.log("dex list:", e.message);
        }
        const count = dexCount();

        // ── INIT CACHE
        if (sub === "init" || sub === "cache") {
            if (!isOwner) return reply("Owner only.");
            try {
                // force refresh
                const cachePath = require("path").join(
                    __dirname,
                    "..",
                    "database",
                    "poke_cache.json"
                );
                try {
                    require("fs").unlinkSync(cachePath);
                } catch (e) {}
                const { loadCache } = require("../lib/pokemon");
                // reset memory by reloading module data
                const list = await ensureList();
                return reply(
                    "✅ Dex cache built.\nSpecies indexed: *" +
                        list.length +
                        "*"
                );
            } catch (e) {
                return reply("❌ Cache failed: " + e.message);
            }
        }

        // ── TEAM
        if (cmd === "team" || cmd === "poketeam" || sub === "team") {
            const user = getUser(sender);
            if (!user.started || !user.team.length) {
                return reply("No team yet.\n*" + p + "pokemon start*");
            }
            let text = "╭━━〔 🎒 YOUR TEAM 〕━━⬣\n┃\n";
            for (let i = 0; i < user.team.length; i++) {
                const m = user.team[i];
                text +=
                    "┃ " +
                    (i + 1) +
                    ". " +
                    (m.shiny ? "✨ " : "") +
                    m.name +
                    "  Lv." +
                    m.level +
                    "  #" +
                    m.dex +
                    "\n┃    " +
                    (m.type || []).join("/") +
                    " · HP " +
                    m.hp +
                    "/" +
                    m.maxHp +
                    "\n";
            }
            text +=
                "┃\n┃ Cards: *" +
                user.team.length +
                "* · Catches: *" +
                (user.catches || 0) +
                "*\n╰━━━━━━━━━━━━━━━━⬣";
            return reply(text);
        }

        // ── POKEDEX
        if (cmd === "pokedex" || sub === "pokedex" || sub === "dex") {
            const q =
                cmd === "pokedex"
                    ? (args || []).join(" ").trim()
                    : rest || "";
            if (!q) return reply("Usage: *" + p + "pokedex pikachu* or *" + p + "pokedex 25*");

            try {
                await reply("📖 Loading dex…");
                const sp = await getSpecies(q);
                if (!sp) return reply("❌ Not found: *" + q + "*");

                const caption =
`╭━━〔 📖 POKÉDEX 〕━━⬣
┃
┃ #\( {sp.id} — * \){sp.name}*
┃ Type: ${(sp.type || []).join(" / ") || "—"}
┃ Rarity: ${stars(sp.rarity)}
┃ Base HP: ${sp.baseHp}
┃
┃ Dex size: \~${count || MAX_SAFE()} species
╰━━━━━━━━━━━━━━━━⬣`;

                await sendArt(sock, from, message, sp, caption, false);
            } catch (e) {
                return reply("❌ Dex error: " + (e.message || e));
            }
            return;
        }

        // ── START
        if (sub === "start") {
            const user = getUser(sender);
            if (user.started && user.team.length) {
                return reply("Already a trainer.\n*" + p + "team*");
            }
            return reply(
`╭━━〔 ⚔️ STARTER 〕━━⬣
┃
┃ Choose:
┃ • bulbasaur  🌿
┃ • charmander 🔥
┃ • squirtle   💧
┃
┃ ${p}pokemon starter charmander
┃
┃ Full dex unlocked after start
┃ (${count || "1000+"} species)
╰━━━━━━━━━━━━━━━━⬣`
            );
        }

        // ── STARTER
        if (sub === "starter" || sub === "choose") {
            const pick = String(rest || "")
                .toLowerCase()
                .replace(/[^a-z-]/g, "");
            if (STARTERS.indexOf(pick) === -1) {
                return reply("Pick: bulbasaur | charmander | squirtle");
            }
            const user = getUser(sender);
            if (user.started && user.team.length) {
                return reply("Starter already chosen.\n*" + p + "team*");
            }
            try {
                const sp = await getSpecies(pick);
                const mon = makeMon(sp, 5);
                setUser(sender, {
                    started: true,
                    team: [mon],
                    catches: 1
                });
                const caption =
`╭━━〔 ✨ STARTER 〕━━⬣
┃
┃ You chose *\( {mon.name}* # \){mon.dex}
┃ Type: ${(mon.type || []).join(" / ")}
┃ Level ${mon.level} · HP ${mon.hp}
┃${mon.shiny ? " ✨ SHINY\n┃" : ""}
┃ ${p}team · ${p}pokedex ${mon.dex}
╰━━━━━━━━━━━━━━━━⬣`;
                await sendArt(sock, from, message, sp, caption, mon.shiny);
            } catch (e) {
                return reply("❌ " + (e.message || e));
            }
            return;
        }

        // ── PROFILE
        if (!sub || sub === "help" || sub === "profile") {
            const user = getUser(sender);
            if (!user.started) return reply(help(p, count));

            const lead = user.team[0];
            const caption =
`╭━━〔 ⚔️ TRAINER 〕━━⬣
┃
┃ Team: *${user.team.length}* cards
┃ Catches: *${user.catches || 0}*
┃ Lead: *${lead ? lead.name + " Lv." + lead.level : "—"}*
┃ Dex: *${count || "1000+"}* species
┃
┃ ${p}team · ${p}pokedex mewtwo
╰━━━━━━━━━━━━━━━━⬣`;

            if (lead) {
                try {
                    const sp = await getSpecies(lead.dex);
                    if (sp) {
                        await sendArt(
                            sock,
                            from,
                            message,
                            sp,
                            caption,
                            lead.shiny
                        );
                        return;
                    }
                } catch (e) {}
            }
            return reply(caption);
        }

        // treat random arg as dex lookup
        try {
            const sp = await getSpecies((args || []).join(" "));
            if (sp) {
                const caption =
`╭━━〔 📖 POKÉDEX 〕━━⬣
┃ #\( {sp.id} — * \){sp.name}*
┃ ${(sp.type || []).join(" / ")} · ${stars(sp.rarity)}
╰━━━━━━━━━━━━━━━━⬣`;
                await sendArt(sock, from, message, sp, caption, false);
                return;
            }
        } catch (e) {}

        return reply(help(p, count));
    }
};

function MAX_SAFE() {
    return 1025;
}
