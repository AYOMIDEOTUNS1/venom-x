const axios = require("axios");

async function getWeather(location) {
    const q = String(location || "").trim();
    if (!q) return null;
    try {
        const url =
            "https://wttr.in/" +
            encodeURIComponent(q) +
            "?format=%l:+%c+%t+%h+%w";
        const res = await axios.get(url, {
            timeout: 15000,
            headers: { "User-Agent": "VENOM-X" }
        });
        const text = String(res.data || "").trim();
        if (!text || text.length > 220) return null;
        return text;
    } catch (e) {
        return null;
    }
}

module.exports = { getWeather };
