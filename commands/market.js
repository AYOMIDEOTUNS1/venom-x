const economy = require("../lib/economy");

const ITEMS = {
    shield: {
        name: "🛡️ Rob Shield",
        price: 500000,
        duration: 60 * 60 * 1000,
        durationText: "1 hour",
        description: "Blocks one successful robbery on your wallet."
    },
    vault: {
        name: "🔐 Secure Vault",
        price: 1000000,
        duration: 24 * 60 * 60 * 1000,
        durationText: "24 hours",
        description: "Protects your bank from robbery."
    },
    xpboost: {
        name: "⚡ XP Boost",
        price: 350000,
        description: "Instantly gives +500 XP."
    },
    bankupgrade: {
        name: "🏦 Bank Upgrade",
        price: 750000,
        description: "Permanently adds +200,000 bank capacity."
    },
    lucky: {
        name: "🍀 Lucky Charm",
        price: 750000,
        duration: 24 * 60 * 60 * 1000,
        durationText: "24 hours",
        description: "+10% game win chance and +50 XP per game."
    }
};

function formatTime(ms) {
    ms = Math.max(0, Number(ms) || 0);
    var totalSeconds = Math.ceil(ms / 1000);
    var hours = Math.floor(totalSeconds / 3600);
    var minutes = Math.floor((totalSeconds % 3600) / 60);
    var seconds = totalSeconds % 60;
    if (hours > 0) return hours + "h " + minutes + "m";
    if (minutes > 0) return minutes + "m " + seconds + "s";
    return seconds + "s";
}

function itemStatus(user, item) {
    var until = Number((user.items && user.items[item + "Until"]) || 0);
    if (until <= Date.now()) return "❌ Inactive";
    return "🟢 " + formatTime(until - Date.now()) + " left";
}

module.exports = {
    name: "market",
    aliases: ["shop", "store"],

    run: async function ({ sock, from, message, sender, args }) {
        var user = economy.get(sender);
        if (!user.inventory || typeof user.inventory !== "object") user.inventory = {};
        if (!user.items || typeof user.items !== "object") user.items = {};

        var action = String((args && args[0]) || "").toLowerCase();

        if (!action) {
            return sock.sendMessage(from, {
                text:
"╭━━〔 🛒 VENOM X MARKET 〕━━⬣\n" +
"┃\n" +
"┃ 💰 Wallet: " + Number(user.balance || 0).toLocaleString() + " VENOM\n" +
"┃\n" +
"┃ 🍀 lucky — 750,000 (24h)\n" +
"┃    +10% win chance, +50 XP/game\n" +
"┃\n" +
"┃ 🛡️ shield — 500,000 (1h)\n" +
"┃    Block 1 wallet robbery\n" +
"┃\n" +
"┃ 🔐 vault — 1,000,000 (24h)\n" +
"┃    Protect bank from rob\n" +
"┃\n" +
"┃ ⚡ xpboost — 350,000\n" +
"┃    Instant +500 XP\n" +
"┃\n" +
"┃ 🏦 bankupgrade — 750,000\n" +
"┃    +200,000 bank capacity\n" +
"┃\n" +
"┃ #market buy <item>\n" +
"┃ #market inventory\n" +
"╰━━━━━━━━━━━━━━━━⬣"
            }, { quoted: message });
        }

        if (action === "inventory" || action === "inv") {
            user = economy.get(sender);
            return sock.sendMessage(from, {
                text:
"╭━━〔 🎒 INVENTORY 〕━━⬣\n" +
"┃\n" +
"┃ 👤 @" + sender.split("@")[0] + "\n" +
"┃\n" +
"┃ 🍀 Lucky: " + itemStatus(user, "lucky") + "\n" +
"┃ 🛡️ Shield: " + itemStatus(user, "shield") + "\n" +
"┃ 🔐 Vault: " + itemStatus(user, "vault") + "\n" +
"┃ 🏦 Bank Upgrade: " + (user.bankUpgraded ? "✅ Yes" : "❌ No") + "\n" +
"╰━━━━━━━━━━━━━━━━⬣",
                mentions: [sender]
            }, { quoted: message });
        }

        if (action !== "buy") {
            return sock.sendMessage(from, {
                text: "❌ Use:\n#market\n#market buy <item>\n#market inventory"
            }, { quoted: message });
        }

        var itemKey = String((args && args[1]) || "").toLowerCase();
        var item = ITEMS[itemKey];
        if (!item) {
            return sock.sendMessage(from, {
                text: "❌ Unknown item.\nAvailable: lucky, shield, vault, xpboost, bankupgrade"
            }, { quoted: message });
        }

        user = economy.get(sender);

        // BANK UPGRADE
        if (itemKey === "bankupgrade") {
            if (user.bankUpgraded || Number(user.bankCapacity) > 1000000) {
                return sock.sendMessage(from, {
                    text: "🔒 Bank already upgraded.\nCapacity: " + Number(user.bankCapacity || 1000000).toLocaleString()
                }, { quoted: message });
            }
            if (Number(user.balance) < item.price) {
                return sock.sendMessage(from, {
                    text: "❌ Need " + item.price.toLocaleString() + " VENOM"
                }, { quoted: message });
            }
            economy.add(sender, -item.price);
            var result = economy.upgradeBank(sender);
            var updated = economy.get(sender);
            return sock.sendMessage(from, {
                text:
"╭━━〔 🏦 BANK UPGRADE 〕━━⬣\n" +
"┃ 💸 Paid: " + item.price.toLocaleString() + "\n" +
"┃ ⬆️ +" + Number(result.increase || 200000).toLocaleString() + "\n" +
"┃ 🏦 New: " + Number(result.newCapacity || updated.bankCapacity).toLocaleString() + "\n" +
"┃ 💰 Wallet: " + Number(updated.balance).toLocaleString() + "\n" +
"╰━━━━━━━━━━━━━━━━⬣"
            }, { quoted: message });
        }

        if (Number(user.balance) < item.price) {
            return sock.sendMessage(from, {
                text:
"❌ Not enough VENOM\n" +
"Price: " + item.price.toLocaleString() + "\n" +
"Wallet: " + Number(user.balance).toLocaleString()
            }, { quoted: message });
        }

        // XP BOOST (instant)
        if (itemKey === "xpboost") {
            economy.add(sender, -item.price);
            var xpResult = economy.addXP(sender, 500);
            updated = economy.get(sender);
            return sock.sendMessage(from, {
                text:
"╭━━〔 ⚡ XP BOOST 〕━━⬣\n" +
"┃ ✨ +500 XP\n" +
"┃ ⭐ Level: " + (xpResult.level || updated.level || 1) + "\n" +
"┃ 💰 Wallet: " + Number(updated.balance).toLocaleString() + "\n" +
"╰━━━━━━━━━━━━━━━━⬣",
                mentions: [sender]
            }, { quoted: message });
        }

        // TIMED ITEMS: lucky / shield / vault
        if (itemKey === "lucky" || itemKey === "shield" || itemKey === "vault") {
            var untilKey = itemKey + "Until";
            var oldUntil = Number((user.items && user.items[untilKey]) || 0);
            var base = oldUntil > Date.now() ? oldUntil : Date.now();
            var newUntil = base + item.duration;

            economy.add(sender, -item.price);

            var inventory = user.inventory || {};
            inventory[itemKey] = Number(inventory[itemKey] || 0) + 1;

            var items = Object.assign({}, user.items || {});
            items[untilKey] = newUntil;

            economy.set(sender, { inventory: inventory, items: items });
            updated = economy.get(sender);

            return sock.sendMessage(from, {
                text:
"╭━━〔 🛒 PURCHASED 〕━━⬣\n" +
"┃ 🛍️ " + item.name + "\n" +
"┃ 💸 " + item.price.toLocaleString() + " VENOM\n" +
"┃ ⏱️ " + item.durationText + "\n" +
"┃ ℹ️ " + item.description + "\n" +
"┃ 💰 Wallet: " + Number(updated.balance).toLocaleString() + "\n" +
"╰━━━━━━━━━━━━━━━━⬣",
                mentions: [sender]
            }, { quoted: message });
        }
    }
};
