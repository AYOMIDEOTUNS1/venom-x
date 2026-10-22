"use strict";

/**
 * VENOM X — Channel VIP Reaction (Omegatech API)
 * #reactch <channel_post_url> <emoji>
 * #rch / #vipreact
 */

const axios = require("axios");
const { getSettings } = require("../lib/settingsCache");

function px() {
    try {
        return getSettings().prefix || "#";
    } catch (e) {
        return "#";
    }
}

async function sendVipReaction(channelUrl, emoji) {
    const apiUrl =
        "https://api.omegatech.app/api/Fun/Rch?action=react&url=" +
        encodeURIComponent(channelUrl) +
        "&emoji=" +
        encodeURIComponent(emoji);

    const { data } = await axios.get(apiUrl, { timeout: 120000 });
    if (!data || data.success === false) {
        throw new Error(
            (data && (data.message || data.error)) || "Reaction failed"
        );
    }
    return data.data || data;
}

function extractEmoji(rest) {
    if (!rest) return "🔥";
    // try first token as emoji / reaction
    const parts = rest.trim().split(/\s+/);
    if (parts[0]) return parts[0];
    return "🔥";
}

module.exports = {
    name: "reactch",
    aliases: ["rch", "vipreact", "creact"],

    run: async function ({ sock, from, args, message, reply }) {
        const prefix = px();

        if (!args || !args.length) {
            return reply(
`╭━━〔 😁 VENOM CHANNEL REACT 〕━━⬣

Send VIP reactions to a *channel post*.

Usage:
${prefix}reactch <post_url> <emoji>

Example:
${prefix}rch https://whatsapp.com/channel/xxx/123 🔥
${prefix}reactch https://whatsapp.com/channel/xxx/1915 😂

╰━━━━━━━━━━━━━━━━⬣`
            );
        }

        const text = args.join(" ");
        const urlMatch = text.match(/(https?:\/\/[^\s]+)/i);
        if (!urlMatch) {
            return reply("❌ Need a WhatsApp *channel post* link.");
        }

        const channelUrl = urlMatch[0];
        if (!/whatsapp\.com\/channel\//i.test(channelUrl)) {
            return reply("❌ Link must be a WhatsApp channel post URL.");
        }

        const rest = text.replace(channelUrl, "").trim();
        const emoji = extractEmoji(rest);

        try {
            await reply(
                "🔄 Sending VIP reaction…\n\n🔗 " +
                    channelUrl +
                    "\n😁 " +
                    emoji +
                    "\n⏱️ Can take 10–20s"
            );

            const result = await sendVipReaction(channelUrl, emoji);

            const time = result.time || result.duration || "—";
            const msg = result.message || "Reaction queued";
            const taskId = result.task_id || result.taskId || "—";
            const emojis = result.emojis || emoji;
            const vipKey = result.vip_key || result.vipKey || "—";
            const vipPackage = result.vip_package || result.vipPackage || "VIP";
            const usageToday = result.usage_today ?? result.usageToday ?? "—";
            const limit = result.limit ?? "—";
            const points =
                result.points_remaining ?? result.pointsRemaining ?? "—";

            // Plain reply — works on iPhone + Android (no rich bot UI)
            return reply(
`╭━━〔 ✅ VIP REACTION 〕━━⬣
┃
┃ 🔗 Target
┃ ${channelUrl}
┃
┃ 😁 Emoji : ${emojis}
┃ ⏱️ Time  : ${time}
┃ 📝 Status: ${msg}
┃ 📋 Task  : ${taskId}
┃
┃ ⭐ VIP
┃ 🔑 Key : ${vipKey}
┃ 📦 Pack: ${vipPackage}
┃ 📊 Use : \( {usageToday}/ \){limit}
┃ 💎 Pts : ${points}
┃
┃ Note: queued — may take a few seconds.
┃
╰━━━━━━━━━━━━━━━━⬣`
            );
        } catch (e) {
            console.error("[REACTCH]", e.message || e);
            return reply(
                "❌ VIP reaction failed:\n" +
                    String(e.message || e).slice(0, 280)
            );
        }
    }
};
