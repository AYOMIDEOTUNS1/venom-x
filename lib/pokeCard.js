"use strict";

/**
 * VENOM X — Pokémon card image (sharp)
 * Frame + art + name + rarity stars + stats
 */

const axios = require("axios");
const sharp = require("sharp");

const W = 720;
const H = 1000;

function escapeXml(s) {
    return String(s || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function starsText(r) {
    r = Math.min(5, Math.max(1, Number(r) || 1));
    return "★".repeat(r) + "☆".repeat(5 - r);
}

function rarityColor(r) {
    r = Number(r) || 1;
    if (r >= 5) return "#ffd700";
    if (r >= 4) return "#c084fc";
    if (r >= 3) return "#60a5fa";
    if (r >= 2) return "#4ade80";
    return "#e5e7eb";
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
 * @param {object} opts
 * @param {string} opts.name
 * @param {number} opts.dex
 * @param {string[]} opts.type
 * @param {number} opts.rarity
 * @param {number} [opts.level]
 * @param {number} [opts.hp]
 * @param {number} [opts.maxHp]
 * @param {boolean} [opts.shiny]
 * @param {string} [opts.artUrl]
 * @param {string} [opts.footer]
 */
async function renderPokeCard(opts) {
    opts = opts || {};
    const name = opts.name || "Unknown";
    const dex = opts.dex || 0;
    const types = Array.isArray(opts.type) ? opts.type : [];
    const rarity = opts.rarity || 1;
    const level = opts.level || 0;
    const hp = opts.hp;
    const maxHp = opts.maxHp;
    const shiny = !!opts.shiny;
    const footer = opts.footer || "VENOM X · POKÉMON";
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
        .resize(520, 520, {
            fit: "contain",
            background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .png()
        .toBuffer();

    const typeLine = types.length ? types.join(" / ") : "Unknown";
    const lvLine = level ? "Lv. " + level : "";
    const hpLine =
        hp != null && maxHp != null
            ? "HP " + hp + " / " + maxHp
            : hp != null
              ? "HP " + hp
              : "";
    const sub = [lvLine, hpLine].filter(Boolean).join("  ·  ");

    const svg = Buffer.from(
        `<svg width="\( {W}" height=" \){H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0f0f14"/>
      <stop offset="100%" stop-color="#1a1025"/>
    </linearGradient>
    <linearGradient id="bar" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${accent}"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0.35"/>
    </linearGradient>
  </defs>

  <!-- outer glow frame -->
  <rect x="18" y="18" width="\( {W - 36}" height=" \){H - 36}" rx="36"
        fill="url(#bg)" stroke="${accent}" stroke-width="6"/>
  <rect x="36" y="36" width="\( {W - 72}" height=" \){H - 72}" rx="28"
        fill="none" stroke="#ffffff" stroke-opacity="0.12" stroke-width="2"/>

  <!-- name ribbon -->
  <rect x="90" y="56" width="${W - 180}" height="64" rx="16" fill="url(#bar)" opacity="0.95"/>
  <text x="${W / 2}" y="100" text-anchor="middle"
        font-family="DejaVu Sans, Arial, sans-serif" font-size="32" font-weight="700"
        fill="#0b0b0f">${escapeXml(name.toUpperCase())}</text>

  <!-- dex -->
  <text x="${W / 2}" y="150" text-anchor="middle"
        font-family="DejaVu Sans, Arial, sans-serif" font-size="22"
        fill="#c4b5fd">#\( {dex} \){shiny ? "  ✦ SHINY" : ""}</text>

  <!-- art window -->
  <rect x="100" y="180" width="520" height="520" rx="24"
        fill="#12121a" stroke="#ffffff" stroke-opacity="0.1" stroke-width="2"/>

  <!-- stars -->
  <text x="${W / 2}" y="760" text-anchor="middle"
        font-family="DejaVu Sans, Arial, sans-serif" font-size="40"
        fill="\( {accent}"> \){starsText(rarity)}</text>

  <!-- type / stats -->
  <text x="${W / 2}" y="820" text-anchor="middle"
        font-family="DejaVu Sans, Arial, sans-serif" font-size="26" font-weight="600"
        fill="#f3f4f6">${escapeXml(typeLine)}</text>
  <text x="${W / 2}" y="860" text-anchor="middle"
        font-family="DejaVu Sans, Arial, sans-serif" font-size="22"
        fill="#9ca3af">${escapeXml(sub)}</text>

  <!-- footer -->
  <text x="${W / 2}" y="940" text-anchor="middle"
        font-family="DejaVu Sans, Arial, sans-serif" font-size="18"
        fill="#6b7280">${escapeXml(footer)}</text>
</svg>`
    );

    const base = await sharp(svg).png().toBuffer();

    const card = await sharp(base)
        .composite([
            {
                input: art,
                top: 180 + Math.floor((520 - 520) / 2),
                left: 100
            }
        ])
        .png()
        .toBuffer();

    return card;
}

module.exports = {
    renderPokeCard,
    starsText,
    rarityColor
};
