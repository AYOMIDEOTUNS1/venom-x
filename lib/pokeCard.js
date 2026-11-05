"use strict";

/**
 * VENOM X — Anime-style Pokémon collectible card
 * Fixes □□□ by embedding a TTF from assets/fonts
 */

const fs = require("fs");
const path = require("path");
const axios = require("axios");
const sharp = require("sharp");

const W = 720;
const H = 1040;

const FONT_PATH = path.join(
    __dirname,
    "..",
    "assets",
    "fonts",
    "Roboto-Bold.ttf"
);

function escapeXml(s) {
    return String(s || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function rarityColor(r) {
    r = Number(r) || 1;
    if (r >= 5) return "#FFD700";
    if (r >= 4) return "#C084FC";
    if (r >= 3) return "#60A5FA";
    if (r >= 2) return "#F472B6";
    return "#E5E7EB";
}

function starLine(r) {
    r = Math.min(5, Math.max(1, Number(r) || 1));
    // ASCII so it never depends on emoji glyphs
    return Array(r + 1).join("*") + Array(5 - r + 1).join("-");
}

function loadFontFace() {
    try {
        if (!fs.existsSync(FONT_PATH)) return "";
        const b64 = fs.readFileSync(FONT_PATH).toString("base64");
        return `
  <style>
    @font-face {
      font-family: "VenomCard";
      src: url("data:font/ttf;base64,${b64}") format("truetype");
      font-weight: bold;
    }
  </style>`;
    } catch (e) {
        return "";
    }
}

async function fetchBuffer(url) {
    const res = await axios.get(url, {
        responseType: "arraybuffer",
        timeout: 30000,
        headers: { "User-Agent": "VENOM-X-CARD" },
        validateStatus: function (s) {
            return s >= 200 && s < 400;
        }
    });
    const buf = Buffer.from(res.data || []);
    if (buf.length < 500) throw new Error("empty art");
    return buf;
}

/**
 * Anime-style card: ribbon name, soft panel, rarity, pokemon art
 */
async function renderPokeCard(opts) {
    opts = opts || {};
    const name = String(opts.name || "Unknown");
    const dex = Number(opts.dex) || 0;
    const types = Array.isArray(opts.type) ? opts.type : [];
    const rarity = opts.rarity || 1;
    const level = opts.level || 0;
    const hp = opts.hp;
    const maxHp = opts.maxHp;
    const shiny = !!opts.shiny;
    const footer = opts.footer || "VENOM X  ·  ANIME x POKEMON";
    const accent = rarityColor(rarity);

    let artUrl = opts.artUrl;
    if (!artUrl) {
        artUrl = shiny
            ? "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/shiny/" +
              dex +
              ".png"
            : "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/" +
              dex +
              ".png";
    }

    const artRaw = await fetchBuffer(artUrl);
    const art = await sharp(artRaw)
        .resize(480, 480, {
            fit: "contain",
            background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .png()
        .toBuffer();

    const typeLine = types.length ? types.join(" / ") : "Unknown";
    const metaBits = [];
    if (level) metaBits.push("Lv " + level);
    if (hp != null && maxHp != null) metaBits.push("HP " + hp + "/" + maxHp);
    else if (hp != null) metaBits.push("HP " + hp);
    if (shiny) metaBits.push("SHINY");
    const metaLine = metaBits.join("   ");

    const fontCss = loadFontFace();
    const fontFamily = fontCss ? "VenomCard" : "sans-serif";

    // Anime-ish chrome: pink/gold ribbon, dark panel (like waifu cards)
    const svg = Buffer.from(
`<svg width="\( {W}" height=" \){H}" xmlns="http://www.w3.org/2000/svg">
  ${fontCss}
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#12061c"/>
      <stop offset="50%" stop-color="#1a0b2e"/>
      <stop offset="100%" stop-color="#0c1224"/>
    </linearGradient>
    <linearGradient id="ribbon" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${accent}"/>
      <stop offset="100%" stop-color="#fb7185"/>
    </linearGradient>
    <linearGradient id="panel" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#1e1b2e"/>
      <stop offset="100%" stop-color="#12101c"/>
    </linearGradient>
  </defs>

  <!-- outer frame -->
  <rect x="16" y="16" width="\( {W - 32}" height=" \){H - 32}" rx="40"
        fill="url(#bg)" stroke="${accent}" stroke-width="7"/>
  <rect x="34" y="34" width="\( {W - 68}" height=" \){H - 68}" rx="32"
        fill="none" stroke="#ffffff" stroke-opacity="0.14" stroke-width="2"/>

  <!-- anime name ribbon -->
  <path d="M 80 70 L ${W - 80} 70 Q ${W - 50} 70 ${W - 50} 100 L ${W - 50} 120 Q ${W - 50} 150 ${W - 80} 150 L 80 150 Q 50 150 50 120 L 50 100 Q 50 70 80 70 Z"
        fill="url(#ribbon)"/>
  <text x="${W / 2}" y="120" text-anchor="middle"
        font-family="${fontFamily}" font-size="34" font-weight="700"
        fill="#1a0520">${escapeXml(name.toUpperCase())}</text>

  <!-- dex line -->
  <text x="${W / 2}" y="190" text-anchor="middle"
        font-family="${fontFamily}" font-size="22"
        fill="#e9d5ff">#${dex}   ${escapeXml(starLine(rarity))}</text>

  <!-- art panel -->
  <rect x="110" y="220" width="500" height="500" rx="28"
        fill="url(#panel)" stroke="#ffffff" stroke-opacity="0.12" stroke-width="2"/>

  <!-- type -->
  <text x="${W / 2}" y="780" text-anchor="middle"
        font-family="${fontFamily}" font-size="28" font-weight="700"
        fill="#fdf2f8">${escapeXml(typeLine)}</text>

  <!-- meta -->
  <text x="${W / 2}" y="830" text-anchor="middle"
        font-family="${fontFamily}" font-size="22"
        fill="#c4b5fd">${escapeXml(metaLine)}</text>

  <!-- flavor strip -->
  <rect x="90" y="860" width="${W - 180}" height="90" rx="18"
        fill="#000000" fill-opacity="0.35"/>
  <text x="${W / 2}" y="905" text-anchor="middle"
        font-family="${fontFamily}" font-size="20"
        fill="#f5e6ff">Anime frame  x  Pokemon art</text>
  <text x="${W / 2}" y="935" text-anchor="middle"
        font-family="${fontFamily}" font-size="18"
        fill="#a78bfa">${escapeXml(footer)}</text>
</svg>`
    );

    const base = await sharp(svg).png().toBuffer();

    return sharp(base)
        .composite([
            {
                input: art,
                left: 120,
                top: 230
            }
        ])
        .png()
        .toBuffer();
}

module.exports = {
    renderPokeCard,
    rarityColor,
    starLine
};
