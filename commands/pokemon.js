"use strict";

const {
    STARTERS,
    getUser,
    setUser,
    ensureList,
    getSpecies,
    makeMon,
    stars,
    dexCount
} = require("../lib/pokemon");
const { renderPokeCard } = require("../lib/pokeCard");
const { getSettings } = require("../lib/settingsCache");

function px() {
    try {
        return getSettings().prefix || "#";
    } catch (e) {
        return "#";
    }
}

async function sendCard(sock, from, message, species, mon, caption) {
    try {
        const buf = await renderPokeCard({
            name: (mon && mon.name) || species.name,
            dex: species.id,
            type: (mon && mon.type) || species.type,
            rarity: (mon && mon.rarity) || species.rarity,
            level: mon && mon.level,
            hp: mon && mon.hp,
            maxHp: mon && mon.maxHp,
            shiny: mon && mon.shiny,
            artUrl: species.sprite || undefined,
            footer: "VENOM X · COLLECTIBLE CARD"
        });
        await sock.sendMessage(
            from,
            { image: buf, caption: caption || "" },
            { quoted: message }
        );
        return true;
    } catch (e) {
        console.log("CARD ERR:", e.message);
        await sock.sendMessage(
            from,
            {
                text:
                    (caption || "") +
                    "\n\n_(card image failed: " +
                    e.message +
                    ")_"
            },
            { quoted: message }
        );
        return false;
    }
}

function help(p, count) {
    return (
`╭━━〔 ⚔️ VENOM POKÉMON 〕━━⬣
┃
┃ Full dex · card art
┃ Species: *${count || "1000+"}*
┃
┃ ${p}pokemon start
┃ ${p}pokemon starter <name>
┃ ${p}team
┃ ${p}pokedex <name|id>
┃ ${p}pokemon init  (owner)
┃
┃ Cards use framed collectible layout
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

        try {
            await ensureList();
        } catch (e) {
            console.log("dex:", e.message);
        }
        const count = dexCount();

        if (sub === "init" || sub === "cache") {
            if (!isOwner) return reply("Owner only.");
            try {
                const fs = require("fs");
                const path = require("path");
                const cachePath = path.join(
                    __dirname,
                    "..",
                    "database",
                    "poke_cache.json"
                );
                try {
                    fs.unlinkSync(cachePath);
                } catch (e) {}
                const list = await ensureList();
                return reply("✅ Dex cache: *" + list.length + "* species");
            } catch (e) {
                return reply("❌ " + e.message);
            }
        }

        if (cmd === "team" || cmd === "poketeam" || sub === "team") {
            const user = getUser(sender);
            if (!user.started || !user.team.length) {
                return reply("No team.\n*" + p + "pokemon start*");
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
                    " Lv." +
                    m.level +
                    " #" +
                    m.dex +
                    "\n";
            }
            text +=
                "┃\n┃ Cards: *" +
                user.team.length +
                "*\n╰━━━━━━━━━━━━━━━━⬣";
            await reply(text);

            // show lead as card
            const lead = user.team[0];
            try {
                const sp = await getSpecies(lead.dex);
                if (sp) {
                    await sendCard(
                        sock,
                        from,
                        message,
                        sp,
                        lead,
                        "⭐ Team lead card"
                    );
                }
            } catch (e) {}
            return;
        }

        if (cmd === "pokedex" || sub === "pokedex" || sub === "dex") {
            const q =
                cmd === "pokedex" ? (args || []).join(" ").trim() : rest;
            if (!q) return reply("Usage: *" + p + "pokedex pikachu*");

            try {
                await reply("🃏 Rendering card…");
                const sp = await getSpecies(q);
                if (!sp) return reply("❌ Not found: *" + q + "*");

                const caption =
                    "📖 *" +
                    sp.name +
                    "* #" +
                    sp.id +
                    "\n" +
                    (sp.type || []).join(" / ") +
                    " · " +
                    stars(sp.rarity);

                await sendCard(sock, from, message, sp, null, caption);
            } catch (e) {
                return reply("❌ " + (e.message || e));
            }
            return;
        }

        if (sub === "start") {
            const user = getUser(sender);
            if (user.started && user.team.length) {
                return reply("Already started.\n*" + p + "team*");
            }
            return reply(
`╭━━〔 ⚔️ STARTER 〕━━⬣
┃ bulbasaur · charmander · squirtle
┃
┃ ${p}pokemon starter charmander
╰━━━━━━━━━━━━━━━━⬣`
            );
        }

        if (sub === "starter" || sub === "choose") {
            const pick = String(rest || "")
                .toLowerCase()
                .replace(/[^a-z-]/g, "");
            if (STARTERS.indexOf(pick) === -1) {
                return reply("Pick: bulbasaur | charmander | squirtle");
            }
            const user = getUser(sender);
            if (user.started && user.team.length) {
                return reply("Starter already chosen.");
            }
            try {
                await reply("🃏 Creating your starter card…");
                const sp = await getSpecies(pick);
                const mon = makeMon(sp, 5);
                setUser(sender, {
                    started: true,
                    team: [mon],
                    catches: 1
                });
                const caption =
                    "✨ Starter unlocked: *" +
                    mon.name +
                    "*\n" +
                    p +
                    "team · " +
                    p +
                    "pokedex " +
                    mon.dex;
                await sendCard(sock, from, message, sp, mon, caption);
            } catch (e) {
                return reply("❌ " + (e.message || e));
            }
            return;
        }

        if (!sub || sub === "help" || sub === "profile") {
            const user = getUser(sender);
            if (!user.started) return reply(help(p, count));

            const lead = user.team[0];
            const caption =
`╭━━〔 ⚔️ TRAINER 〕━━⬣
┃ Cards: *${user.team.length}*
┃ Catches: *${user.catches || 0}*
┃ Lead: *${lead ? lead.name + " Lv." + lead.level : "—"}*
┃ Dex: *${count || "1000+"}*
╰━━━━━━━━━━━━━━━━⬣`;

            await reply(caption);
            if (lead) {
                try {
                    const sp = await getSpecies(lead.dex);
                    if (sp) await sendCard(sock, from, message, sp, lead, "");
                } catch (e) {}
            }
            return;
        }

        try {
            const sp = await getSpecies((args || []).join(" "));
            if (sp) {
                await sendCard(
                    sock,
                    from,
                    message,
                    sp,
                    null,
                    "📖 " + sp.name + " #" + sp.id
                );
                return;
            }
        } catch (e) {}

        return reply(help(p, count));
    }
};
