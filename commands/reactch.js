"use strict";

/**
 * VENOM X — Channel React (Omegatech Rch)
 * #rch / #reactch / #chreact <post_link> [emoji...]
 * No economy / no fee
 */

const axios = require("axios");
const { getSettings } = require("../lib/settingsCache");

const API_BASE = "https://api.omegatech.app/api/Fun/Rch";
const MAX_RETRIES = 3;

const POOL_MAIN = ["🪀", "🎰", "🃏"];
const POOL_RARE = ["❤️", "💀", "🎃"];

function px() {
    try {
        return getSettings().prefix || "#";
    } catch (e) {
        return "#";
    }
}

function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function sleep(ms) {
    return new Promise(function (r) {
        setTimeout(r, ms);
    });
}

function pickEmoji() {
    return Math.random() < 0.75 ? pick(POOL_MAIN) : pick(POOL_RARE);
}

function isValidChannelUrl(url) {
    return /whatsapp\.com\/channel\/[A-Za-z0-9]+\/?\d*/i.test(String(url || ""));
}

async function sendReactions(postUrl, emojis) {
    try {
        const res = await axios.get(API_BASE, {
            params: {
                action: "react",
                url: postUrl,
                emoji: emojis.join(",")
            },
            timeout: 45000,
            validateStatus: function () {
                return true;
            },
            headers: {
                "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
                Accept: "application/json, text/plain, */*",
                "Accept-Language": "en-US,en;q=0.9"
            }
        });

        const d = res.data || {};
        const result = d.data || {};
        const ok =
            res.status === 200 &&
            d.success === true &&
            (result.ok === true ||
                result.ok === undefined ||
                !!result.task_id ||
                !!result.message);

        return {
            ok: !!ok,
            status: res.status,
            raw: d,
            debug: !ok ? JSON.stringify(d).slice(0, 300) : null
        };
    } catch (e) {
        return {
            ok: false,
            status: e.response && e.response.status,
            error:
                e.response && e.response.status
                    ? "HTTP " + e.response.status
                    : e.message,
            debug:
                e.response && e.response.data
                    ? JSON.stringify(e.response.data).slice(0, 300)
                    : null
        };
    }
}

async function reactToPost(postUrl, emojiList) {
    let lastError = "unknown";
    let lastDebug = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        const r = await sendReactions(postUrl, emojiList);
        if (r.ok) {
            return { ok: true, attempt: attempt, raw: r.raw };
        }
        lastError = r.error || "react HTTP " + r.status;
        lastDebug = r.debug || null;
        if (attempt < MAX_RETRIES) {
            await sleep(1500 + Math.random() * 1500);
        }
    }

    return {
        ok: false,
        attempts: MAX_RETRIES,
        error: lastError,
        debug: lastDebug
    };
}

function filterEmojis(list) {
    const out = [];
    for (let i = 0; i < list.length; i++) {
        const a = String(list[i] || "").trim();
        if (!a) continue;
        // skip leftover url fragments
        if (/^https?:\/\//i.test(a)) continue;
        if (/whatsapp\.com/i.test(a)) continue;
        out.push(a);
    }
    return out;
}

module.exports = {
    name: "reactch",
    aliases: ["rch", "chreact", "ch-react", "channelreact", "vipreact"],

    run: async function ({ sock, from, args, message, reply }) {
        const prefix = px();

        try {
            await sock.sendMessage(from, {
                react: { text: "🟡", key: message.key }
            });
        } catch (e) {}

        const postUrl = args[0];

        if (!postUrl) {
            return reply(
`╭━━〔 😁 VENOM CHANNEL REACT 〕━━⬣

React to a WhatsApp *channel post*.

Usage:
${prefix}rch <post_link>
${prefix}rch <post_link> 😂
${prefix}rch <post_link> 😂 🤣

Example:
${prefix}rch https://whatsapp.com/channel/xxxxxx/148 🔥

╰━━━━━━━━━━━━━━━━⬣`
            );
        }

        if (!isValidChannelUrl(postUrl)) {
            return reply(
`❌ *Invalid link*

Need a channel post URL like:
https://whatsapp.com/channel/XXXXXXX/148`
            );
        }

        let emojiList = filterEmojis(args.slice(1));
        if (!emojiList.length) {
            emojiList = [pickEmoji()];
        }
        const emojiStr = emojiList.join(" ");

        await reply(
            "🟡 Reacting with *" + emojiStr + "*…\n_Can take a few seconds._"
        );

        let res;
        try {
            res = await reactToPost(postUrl, emojiList);
        } catch (err) {
            console.error("[rch] reactToPost:", err.message);
            res = { ok: false, attempts: 1, error: err.message };
        }

        if (res.ok) {
            try {
                await sock.sendMessage(from, {
                    react: { text: "🟢", key: message.key }
                });
            } catch (e) {}

            const d = (res.raw && res.raw.data) || {};
            const taskId = d.task_id || "—";
            const timeMs = d.time || "—";
            const usage = d.usage_today != null ? d.usage_today : "?";
            const limit = d.limit != null ? d.limit : "?";
            const msg = d.message || "Queued";

            return reply(
`╭━━〔 🟢 REACTION SENT 〕━━⬣
┃
┃ 😁 Emoji : *${emojiStr}*
┃ 🔗 Post  : ${postUrl}
┃ 🔄 Tries : *${res.attempt}*
┃ ⏱️ Time  : *${timeMs}*
┃ 🆔 Task  : ${taskId}
┃ 📊 Usage : *\( {usage}/ \){limit}*
┃ 📝 ${msg}
┃
┃ _Check the channel to verify._
╰━━━━━━━━━━━━━━━━⬣`
            );
        }

        try {
            await sock.sendMessage(from, {
                react: { text: "🔴", key: message.key }
            });
        } catch (e) {}

        let fail =
`╭━━〔 🔴 REACTION FAILED 〕━━⬣
┃
┃ 😁 Emoji : *${emojiStr}*
┃ 🔗 Post  : ${postUrl}
┃ 🔄 Tries : *${res.attempts || MAX_RETRIES}*
┃ ⚠️ ${res.error || "unknown"}
┃
╰━━━━━━━━━━━━━━━━⬣`;

        if (res.debug) {
            fail += "\n\n📦 `" + res.debug + "`";
        }

        return reply(fail);
    }
};
