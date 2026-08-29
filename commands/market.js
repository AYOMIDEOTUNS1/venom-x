const economy = require("../lib/economy");

// ============================================================
// MARKET CONFIG
// ============================================================

const ITEMS = {
    shield: {
        name: "🛡️ Rob Shield",
        price: 500000,
        duration: 60 * 60 * 1000,
        durationText: "1 hour",
        description:
            "Protects you from one successful robbery."
    },

    vault: {
        name: "🔐 Secure Vault",
        price: 1000000,
        duration: 24 * 60 * 60 * 1000,
        durationText: "24 hours",
        description:
            "Protects your bank from robbery."
    },

    xpboost: {
        name: "⚡ XP Boost",
        price: 350000,
        description:
            "Instantly gives 500 XP."
    },

    bankupgrade: {
        name: "🏦 Bank Upgrade",
        price: 750000,
        description:
            "Permanently adds 200,000 bank capacity."
    },

    lucky: {
        name: "🍀 Lucky Charm",
        price: 750000,
        duration: 24 * 60 * 60 * 1000,
        durationText: "24 hours",
        description:
            "Gives +50 bonus XP after completed games."
    }
};

const LUCKY_GAME_XP =
    50;

// ============================================================
// TIME FORMAT
// ============================================================

function formatTime(ms) {
    ms = Math.max(
        0,
        Number(ms) || 0
    );

    const totalSeconds =
        Math.ceil(ms / 1000);

    const days =
        Math.floor(
            totalSeconds / 86400
        );

    const hours =
        Math.floor(
            (totalSeconds % 86400) / 3600
        );

    const minutes =
        Math.floor(
            (totalSeconds % 3600) / 60
        );

    const seconds =
        totalSeconds % 60;

    const parts = [];

    if (days > 0) {
        parts.push(`${days}d`);
    }

    if (hours > 0) {
        parts.push(`${hours}h`);
    }

    if (minutes > 0) {
        parts.push(`${minutes}m`);
    }

    if (
        seconds > 0 &&
        parts.length < 2
    ) {
        parts.push(`${seconds}s`);
    }

    return parts.join(" ") || "0s";
}

// ============================================================
// INVENTORY
// ============================================================

function ensureInventory(user) {
    if (
        !user.inventory ||
        typeof user.inventory !== "object"
    ) {
        user.inventory = {};
    }

    return user.inventory;
}

// ============================================================
// ACTIVE ITEM DISPLAY
// ============================================================

function itemStatus(user, item) {
    const until =
        Number(
            user.items?.[`${item}Until`] || 0
        );

    if (until <= Date.now()) {
        return "❌ Inactive";
    }

    return `🟢 ${formatTime(
        until - Date.now()
    )} remaining`;
}

// ============================================================
// MODULE
// ============================================================

module.exports = {
    name: "market",

    aliases: [
        "shop",
        "store"
    ],

    run: async ({
        sock,
        from,
        message,
        sender,
        args
    }) => {

        let user =
            economy.get(sender);

        const inventory =
            ensureInventory(user);

        const action =
            String(
                args?.[0] || ""
            ).toLowerCase();

        // =====================================================
        // MARKET MENU
        // =====================================================

        if (!action) {

            return sock.sendMessage(
                from,
                {
                    text:
`╭━━〔 🛒 VENOM X MARKET 〕━━⬣
┃
┃ 💰 Wallet
┃    ${Number(
    user.balance
).toLocaleString()} VENOM
┃
┃ 💎 PREMIUM ITEMS
┃
┃ 🍀 lucky
┃    750,000 VENOM
┃    ⏱️ 24 hours
┃    ✨ +50 XP/game
┃
┃ 🛡️ shield
┃    500,000 VENOM
┃    ⏱️ 1 hour
┃    🚔 Rob protection
┃
┃ 🔐 vault
┃    1,000,000 VENOM
┃    ⏱️ 24 hours
┃    🏦 Bank protection
┃
┃ ⚡ xpboost
┃    350,000 VENOM
┃    ✨ Instant +500 XP
┃
┃ 🏦 bankupgrade
┃    750,000 VENOM
┃    ♾️ Permanent
┃    ⬆️ +200,000 capacity
┃
┃ ━━━━━━━━━━━━━━━
┃
┃ 📦 Commands
┃ .market buy <item>
┃ .market inventory
┃
┃ Example:
┃ .market buy lucky
╰━━━━━━━━━━━━━━━━⬣`
                },
                {
                    quoted: message
                }
            );
        }

        // =====================================================
        // INVENTORY
        // =====================================================

        if (
            action === "inventory" ||
            action === "inv"
        ) {

            user =
                economy.get(sender);

            return sock.sendMessage(
                from,
                {
                    text:
`╭━━〔 🎒 VENOM INVENTORY 〕━━⬣
┃
┃ 👤 @${sender.split("@")[0]}
┃
┃ 🍀 Lucky Charm
┃    Owned : ${Number(
        inventory.lucky || 0
    )}
┃    ${itemStatus(user, "lucky")}
┃
┃ 🛡️ Rob Shield
┃    Owned : ${Number(
        inventory.shield || 0
    )}
┃    ${itemStatus(user, "shield")}
┃
┃ 🔐 Secure Vault
┃    Owned : ${Number(
        inventory.vault || 0
    )}
┃    ${itemStatus(user, "vault")}
┃
┃ ⚡ XP Boost
┃    Instant-use item
┃
┃ 🏦 Bank Upgrade
┃    ${user.bankUpgraded
        ? "✅ Purchased"
        : "❌ Not purchased"}
╰━━━━━━━━━━━━━━━━⬣`,
                    mentions: [sender]
                },
                {
                    quoted: message
                }
            );
        }

        // =====================================================
        // BUY
        // =====================================================

        if (action !== "buy") {

            return sock.sendMessage(
                from,
                {
                    text:
`❌ Invalid market command.

Use:

.market
.market buy <item>
.market inventory`
                },
                {
                    quoted: message
                }
            );
        }

        const itemKey =
            String(
                args?.[1] || ""
            ).toLowerCase();

        const item =
            ITEMS[itemKey];

        if (!item) {

            return sock.sendMessage(
                from,
                {
                    text:
`❌ Unknown item.

Available:

🍀 lucky
🛡️ shield
🔐 vault
⚡ xpboost
🏦 bankupgrade`
                },
                {
                    quoted: message
                }
            );
        }

        user =
            economy.get(sender);

        // =====================================================
        // BANK UPGRADE
        // =====================================================

        if (
            itemKey === "bankupgrade"
        ) {

            if (
                user.bankUpgraded ||
                user.bankCapacity >
                    1000000
            ) {

                return sock.sendMessage(
                    from,
                    {
                        text:
`╭━━〔 🏦 BANK MAXED 〕━━⬣
┃
┃ 🔒 Already upgraded.
┃
┃ 🏦 Capacity
┃    ${Number(
        user.bankCapacity
    ).toLocaleString()} VENOM
╰━━━━━━━━━━━━━━━━⬣`
                    },
                    {
                        quoted: message
                    }
                );
            }

            if (
                user.balance <
                item.price
            ) {
                return sock.sendMessage(
                    from,
                    {
                        text:
`❌ You need ${item.price.toLocaleString()} VENOM.

💰 Wallet :
${Number(
    user.balance
).toLocaleString()} VENOM`
                    },
                    {
                        quoted: message
                    }
                );
            }

            economy.add(
                sender,
                -item.price
            );

            const result =
                economy.upgradeBank(
                    sender
                );

            const updated =
                economy.get(sender);

            return sock.sendMessage(
                from,
                {
                    text:
`╭━━〔 🏦 BANK UPGRADE 〕━━⬣
┃
┃ 👤 @${sender.split("@")[0]}
┃
┃ 💸 Paid
┃    ${item.price.toLocaleString()} VENOM
┃
┃ 🏦 Old Capacity
┃    ${Number(
        result.oldCapacity
    ).toLocaleString()}
┃
┃ ⬆️ Increase
┃    +${Number(
        result.increase
    ).toLocaleString()}
┃
┃ 🏦 New Capacity
┃    ${Number(
        result.newCapacity
    ).toLocaleString()} VENOM
┃
┃ ♾️ Permanent
┃
┃ 💰 Wallet
┃    ${Number(
        updated.balance
    ).toLocaleString()} VENOM
╰━━━━━━━━━━━━━━━━⬣`,
                    mentions: [sender]
                },
                {
                    quoted: message
                }
            );
        }

        // =====================================================
        // BALANCE CHECK
        // =====================================================

        if (
            Number(user.balance) <
            item.price
        ) {

            return sock.sendMessage(
                from,
                {
                    text:
`╭━━〔 ❌ PURCHASE FAILED 〕━━⬣
┃
┃ 🛍️ ${item.name}
┃
┃ 💸 Price
┃    ${item.price.toLocaleString()} VENOM
┃
┃ 💰 Wallet
┃    ${Number(
        user.balance
    ).toLocaleString()} VENOM
┃
┃ ❌ Not enough VENOM.
╰━━━━━━━━━━━━━━━━⬣`
                },
                {
                    quoted: message
                }
            );
        }

        // =====================================================
        // XP BOOST
        // =====================================================

        if (
            itemKey === "xpboost"
        ) {

            economy.add(
                sender,
                -item.price
            );

            const result =
                economy.addXP(
                    sender,
                    500
                );

            const updated =
                economy.get(sender);

            return sock.sendMessage(
                from,
                {
                    text:
`╭━━〔 ⚡ XP BOOST 〕━━⬣
┃
┃ 👤 @${sender.split("@")[0]}
┃
┃ 💸 Paid
┃    ${item.price.toLocaleString()} VENOM
┃
┃ ✨ XP
┃    +500
┃
┃ ⭐ Level
┃    ${updated.level}
┃
┃ 📈 Total XP
┃    ${updated.xp}
┃
┃ 💰 Wallet
┃    ${Number(
        updated.balance
    ).toLocaleString()} VENOM
╰━━━━━━━━━━━━━━━━⬣`,
                    mentions: [sender]
                },
                {
                    quoted: message
                }
            );
        }

        // =====================================================
        // TIMED ITEMS
        // =====================================================

        if (
            itemKey === "lucky" ||
            itemKey === "shield" ||
            itemKey === "vault"
        ) {

            const untilKey =
                `${itemKey}Until`;

            const currentlyActive =
                Number(
                    user.items?.[untilKey] || 0
                ) > Date.now();

            // Buy another one:
            // extend the existing timer.
            const oldUntil =
                currentlyActive
                    ? Number(
                        user.items[untilKey]
                    )
                    : Date.now();

            economy.add(
                sender,
                -item.price
            );

            const newUntil =
                oldUntil +
                item.duration;

            inventory[itemKey] =
                Number(
                    inventory[itemKey] || 0
                ) + 1;

            economy.set(sender, {
                inventory,

                items: {
                    ...user.items,
                    [untilKey]: newUntil
                }
            });

            const updated =
                economy.get(sender);

            return sock.sendMessage(
                from,
                {
                    text:
`╭━━〔 🛒 PURCHASE SUCCESS 〕━━⬣
┃
┃ 👤 @${sender.split("@")[0]}
┃
┃ 🛍️ ${item.name}
┃
┃ 💸 Paid
┃    ${item.price.toLocaleString()} VENOM
┃
┃ ⏱️ Duration
┃    ${item.durationText}
┃
┃ 📅 New Expiry
┃    ${new Date(
        newUntil
    ).toLocaleString()}
┃
┃ 🎒 Owned
┃    ${inventory[itemKey]}
┃
┃ ℹ️ ${item.description}
┃
┃ 💰 Wallet
┃    ${Number(
        updated.balance
    ).toLocaleString()} VENOM
╰━━━━━━━━━━━━━━━━⬣`,
                    mentions: [sender]
                },
                {
                    quoted: message
                }
            );
        }

        // =====================================================
        // FALLBACK
        // =====================================================

        economy.add(
            sender,
            -item.price
        );

        inventory[itemKey] =
            Number(
                inventory[itemKey] || 0
            ) + 1;

        economy.set(sender, {
            inventory
        });

        const updated =
            economy.get(sender);

        await sock.sendMessage(
            from,
            {
                text:
`╭━━〔 🛒 PURCHASE SUCCESS 〕━━⬣
┃
┃ 🛍️ ${item.name}
┃
┃ 💸 Paid
┃    ${item.price.toLocaleString()} VENOM
┃
┃ 🎒 Owned
┃    ${inventory[itemKey]}
┃
┃ 💰 Wallet
┃    ${Number(
        updated.balance
    ).toLocaleString()} VENOM
╰━━━━━━━━━━━━━━━━⬣`,
                mentions: [sender]
            },
            {
                quoted: message
            }
        );
    }
};
