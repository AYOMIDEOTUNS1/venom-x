"use strict";

/**
 * VENOM X Pokémon — full National Dex via PokeAPI + disk cache
 * Species \~1025+ | Each catch = 1 card instance (unlimited cards)
 */

const fs = require("fs");
const path = require("path");
const axios = require("axios");

const DATA_DIR = path.join(__dirname, "..", "database");
const USER_FILE = path.join(DATA_DIR, "pokemon.json");
const CACHE_FILE = path.join(DATA_DIR, "poke_cache.json");

const STARTERS = ["bulbasaur", "charmander", "squirtle"];
const API = "https://pokeapi.co/api/v2";
const MAX_DEX = 1025; // national dex ballpark (Gen 1–9)

let memoryCache = null;
let listPromise = null;

function ensureDir() {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadJson(file, fallback) {
    ensureDir();
    try {
        if (!fs.existsSync(file)) return fallback;
        return JSON.parse(fs.readFileSync(file, "utf8") || "null") || fallback;
    } catch (e) {
        return fallback;
    }
}

function saveJson(file, data) {
    ensureDir();
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function loadUsers() {
    return loadJson(USER_FILE, {});
}

function saveUsers(data) {
    saveJson(USER_FILE, data);
}

function normKey(id) {
    return String(id || "").split(":")[0];
}

function getUser(uid) {
    const db = loadUsers();
    const key = normKey(uid);
    if (!db[key]) {
        db[key] = {
            started: false,
            team: [],
            box: [],
            catches: 0,
            createdAt: Date.now()
        };
        saveUsers(db);
    }
    return db[key];
}

function setUser(uid, patch) {
    const db = loadUsers();
    const key = normKey(uid);
    const cur = getUser(uid);
    db[key] = Object.assign({}, cur, patch);
    saveUsers(db);
    return db[key];
}

function loadCache() {
    if (memoryCache) return memoryCache;
    memoryCache = loadJson(CACHE_FILE, { list: [], byId: {}, byName: {}, updatedAt: 0 });
    return memoryCache;
}

function saveCache() {
    if (memoryCache) saveJson(CACHE_FILE, memoryCache);
}

/** Build / refresh full species index (name + id only — light) */
async function ensureList() {
    const cache = loadCache();
    if (cache.list && cache.list.length >= 900) {
        return cache.list;
    }
    if (listPromise) return listPromise;

    listPromise = (async function () {
        const { data } = await axios.get(API + "/pokemon", {
            params: { limit: 2000, offset: 0 },
            timeout: 60000,
            headers: { "User-Agent": "VENOM-X-POKE" }
        });
        const results = data.results || [];
        const list = [];
        const byId = {};
        const byName = {};

        for (let i = 0; i < results.length; i++) {
            const r = results[i];
            const name = String(r.name || "").toLowerCase();
            // extract id from url .../pokemon/25/
            const m = String(r.url || "").match(/\/pokemon\/(\d+)\/?$/);
            const id = m ? Number(m[1]) : i + 1;
            // skip absurd multi-form junk ids if any beyond practical dex
            if (id > 10275) continue;
            const row = { id: id, name: name };
            list.push(row);
            byId[id] = row;
            byName[name] = row;
        }

        memoryCache = {
            list: list,
            byId: byId,
            byName: byName,
            detail: (cache.detail || {}),
            updatedAt: Date.now()
        };
        saveCache();
        listPromise = null;
        return list;
    })();

    try {
        return await listPromise;
    } catch (e) {
        listPromise = null;
        throw e;
    }
}

function rarityFromId(id) {
    id = Number(id) || 1;
    // light rarity curve — legendaries-ish bands by dex (approx, not accurate lore)
    if (id >= 144 && id <= 146) return 4; // birds
    if (id === 150 || id === 151) return 5;
    if (id >= 243 && id <= 245) return 4;
    if (id === 249 || id === 250 || id === 251) return 5;
    if (id >= 377 && id <= 386) return 4;
    if (id >= 480 && id <= 493) return 4;
    if (id >= 638 && id <= 649) return 4;
    if (id >= 716 && id <= 721) return 5;
    if (id >= 785 && id <= 809) return 4;
    if (id >= 888 && id <= 898) return 4;
    if (id >= 1007) return 4;
    if (id % 50 === 0) return 3;
    if (id % 20 === 0) return 2;
    return 1;
}

/** Full detail for one species (types, stats, sprite) — cached */
async function getSpecies(nameOrId) {
    await ensureList();
    const cache = loadCache();
    if (!cache.detail) cache.detail = {};

    let id = null;
    let name = null;
    const q = String(nameOrId || "").toLowerCase().trim();

    if (/^\d+$/.test(q)) {
        id = Number(q);
        name = cache.byId[id] && cache.byId[id].name;
    } else {
        const cleaned = q.replace(/[^a-z0-9-]/g, "");
        if (cache.byName[cleaned]) {
            id = cache.byName[cleaned].id;
            name = cleaned;
        } else {
            // fuzzy startsWith
            const keys = Object.keys(cache.byName || {});
            for (let i = 0; i < keys.length; i++) {
                if (keys[i].startsWith(cleaned)) {
                    name = keys[i];
                    id = cache.byName[name].id;
                    break;
                }
            }
        }
    }

    if (!id) return null;

    if (cache.detail[id] && cache.detail[id].name) {
        return cache.detail[id];
    }

    const { data } = await axios.get(API + "/pokemon/" + id, {
        timeout: 30000,
        headers: { "User-Agent": "VENOM-X-POKE" }
    });

    const types = (data.types || [])
        .sort(function (a, b) {
            return a.slot - b.slot;
        })
        .map(function (t) {
            return t.type && t.type.name
                ? t.type.name.charAt(0).toUpperCase() + t.type.name.slice(1)
                : "?";
        });

    let hp = 40;
    const stats = data.stats || [];
    for (let i = 0; i < stats.length; i++) {
        if (stats[i].stat && stats[i].stat.name === "hp") {
            hp = stats[i].base_stat || 40;
        }
    }

    const entry = {
        id: data.id,
        key: data.name,
        name: data.name.charAt(0).toUpperCase() + data.name.slice(1),
        type: types,
        baseHp: hp,
        rarity: rarityFromId(data.id),
        sprite:
            (data.sprites &&
                data.sprites.other &&
                data.sprites.other["official-artwork"] &&
                data.sprites.other["official-artwork"].front_default) ||
            (data.sprites && data.sprites.front_default) ||
            null
    };

    cache.detail[id] = entry;
    memoryCache = cache;
    // persist occasionally (not every call to reduce disk)
    if (Object.keys(cache.detail).length % 5 === 0) saveCache();
    else saveCache();

    return entry;
}

function spriteUrl(dexId, shiny) {
    const id = Number(dexId) || 1;
    if (shiny) {
        return (
            "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/shiny/" +
            id +
            ".png"
        );
    }
    return (
        "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/" +
        id +
        ".png"
    );
}

function stars(r) {
    r = Math.min(5, Math.max(1, Number(r) || 1));
    return "★".repeat(r) + "☆".repeat(5 - r);
}

function makeMon(species, level) {
    if (!species) return null;
    const lv = Math.max(1, Number(level) || 5);
    const hp = (species.baseHp || 40) + lv * 2;
    return {
        uid: "m" + Date.now().toString(36) + Math.floor(Math.random() * 9999),
        key: species.key || species.name.toLowerCase(),
        name: species.name,
        dex: species.id,
        type: (species.type || []).slice(),
        level: lv,
        xp: 0,
        hp: hp,
        maxHp: hp,
        shiny: Math.random() < 0.015,
        rarity: species.rarity || rarityFromId(species.id),
        caughtAt: Date.now()
    };
}

/** Random wild species id (weighted toward lower dex / common) */
async function randomSpecies() {
    await ensureList();
    const cache = loadCache();
    const list = (cache.list || []).filter(function (x) {
        return x.id >= 1 && x.id <= MAX_DEX;
    });
    if (!list.length) return null;

    // 70% first 151, 20% 152-493, 10% rest — more classic spawns
    const roll = Math.random();
    let pool;
    if (roll < 0.7) {
        pool = list.filter(function (x) {
            return x.id <= 151;
        });
    } else if (roll < 0.9) {
        pool = list.filter(function (x) {
            return x.id > 151 && x.id <= 493;
        });
    } else {
        pool = list.filter(function (x) {
            return x.id > 493 && x.id <= MAX_DEX;
        });
    }
    if (!pool.length) pool = list;
    const row = pool[Math.floor(Math.random() * pool.length)];
    return getSpecies(row.id);
}

function dexCount() {
    const cache = loadCache();
    return (cache.list && cache.list.length) || 0;
}

module.exports = {
    STARTERS,
    MAX_DEX,
    getUser,
    setUser,
    ensureList,
    getSpecies,
    spriteUrl,
    makeMon,
    stars,
    randomSpecies,
    dexCount,
    rarityFromId,
    saveCache,
    loadCache
};
