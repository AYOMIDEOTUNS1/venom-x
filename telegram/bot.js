const TelegramBot = require("node-telegram-bot-api");
const path = require("path");

const sessionManager = require(path.join(__dirname, "sessionManager"));
const licenseManager = require(path.join(__dirname, "licenseManager"));
const {
    normalizePhone,
    isValidPhone
} = require(path.join(__dirname, "pairing"));

function startTelegramBot() {
    const token = process.env.TELEGRAM_BOT_TOKEN;

    if (!token) {
        console.log("⚠️ TELEGRAM_BOT_TOKEN missing — Telegram service disabled."); return null;
    }

    const ownerId =
        String(process.env.OWNER_TELEGRAM_ID || "").trim();

    const ownerUsername = "@AYOMIDEOTUNS";

    const bot = new TelegramBot(token, {
        polling: true
    });

    const waitingNumber = new Map();

    async function send(chatId, text, options = {}) {
        try {
            return await bot.sendMessage(
                chatId,
                String(text),
                options
            );
        } catch (err) {
            console.log(
                "Telegram send error:",
                err?.message || err
            );
            return null;
        }
    }

    async function notifyUser(chatId, text) {
        return send(chatId, text, {
            parse_mode: undefined
        });
    }

    function isOwner(userId) {
        return String(userId) === ownerId;
    }

    function licenseRequiredText() {
        return (
`🔐 *LICENSE REQUIRED*

Activate your VENOM X license first:

\`/activate YOUR-CODE\`

👑 Owner: ${ownerUsername}`
        );
    }

    function accessRequiredText() {
        return (
`🔐 *VENOM X ACCESS REQUIRED*

You don't currently have an active license.

Please enter your license code using:

\`/activate YOUR-CODE\`

👑 Owner: ${ownerUsername}`
        );
    }

    function durationHelp() {
        return (
`👑 *VENOM X CODE GENERATOR*

Generate a user access code.

Available durations:

\`/genkey 1week\`
\`/genkey 2weeks\`
\`/genkey 1month\`
\`/genkey unlimited\`

Alias:

\`/gen 1week\`
\`/gen 2weeks\`
\`/gen 1month\`
\`/gen unlimited\``
        );
    }

    function maskPhone(phone) {
        if (!phone) return "N/A";

        const value = String(phone);

        if (value.length <= 5) {
            return `+${value}`;
        }

        return `+${value.slice(0, 3)}*******${value.slice(-2)}`;
    }

    const mainMenu = {
        reply_markup: {
            inline_keyboard: [
                [
                    {
                        text: "🔗 Pair WhatsApp",
                        callback_data: "pair"
                    }
                ],
                [
                    {
                        text: "📊 My Status",
                        callback_data: "status"
                    },
                    {
                        text: "📱 My Numbers",
                        callback_data: "numbers"
                    }
                ],
                [
                    {
                        text: "❌ Disconnect",
                        callback_data: "disconnect"
                    },
                    {
                        text: "ℹ️ Help",
                        callback_data: "help"
                    }
                ]
            ]
        }
    };

    async function startPair(uid, chatId, phoneRaw) {
        const phone = normalizePhone(phoneRaw);

        if (!phone) {
            return send(
                chatId,
                "❌ Invalid number.\n\nExample: `2348160000000`",
                {
                    parse_mode: "Markdown"
                }
            );
        }

        const access =
            licenseManager.checkAccess(uid);

        if (!access.active) {
            return send(
                chatId,
                accessRequiredText(),
                {
                    parse_mode: "Markdown"
                }
            );
        }

        await send(
            chatId,
            `🚀 Starting VENOM X pairing for +${phone}...`
        );

        try {
            await sessionManager.createSocket(
                uid,
                phone,
                text => notifyUser(chatId, text)
            );
        } catch (err) {
            await send(
                chatId,
                `❌ ${err?.message || err}`
            );
        }
    }

    // =========================================================
    // /START
    // =========================================================

    bot.onText(/^\/start(?:@\w+)?$/i, async msg => {
        const chatId = msg.chat.id;

        await send(
            chatId,
`🐍 *VENOM X*

Welcome to the VENOM X WhatsApp Pairing Service.

🔐 Licensed access
📱 Multi-number WhatsApp sessions
⚡ Automatic session management

Choose an option below:

👑 Owner: ${ownerUsername}`,
            {
                parse_mode: "Markdown",
                ...mainMenu
            }
        );
    });

    // =========================================================
    // /HELP
    // =========================================================

    bot.onText(/^\/help(?:@\w+)?$/i, async msg => {
        await send(
            msg.chat.id,
`ℹ️ *VENOM X HELP*

/start — Main menu
/activate CODE — Activate your license
/pair — Pair WhatsApp
/status — Check active session
/numbers — View your numbers
/disconnect — Disconnect current session
/unpair NUMBER — Delete a WhatsApp session

*Owner commands:*

/genkey 1week
/genkey 2weeks
/genkey 1month
/genkey unlimited

/gen 1week — alias

/revoke CODE
/licenses
/users
/stopall

👑 Owner: ${ownerUsername}`,
            {
                parse_mode: "Markdown"
            }
        );
    });

    // =========================================================
    // /ACTIVATE
    // =========================================================

    bot.onText(
        /^\/activate(?:@\w+)?(?:\s+(.+))?$/i,
        async (msg, match) => {
            const uid = String(msg.from.id);
            const chatId = msg.chat.id;

            const code =
                match && match[1]
                    ? String(match[1]).trim()
                    : "";

            if (!code) {
                return send(
                    chatId,
`🔐 *ACTIVATE LICENSE*

Usage:

\`/activate VX-XXXXXX-XXXXXX\`

👑 Owner: ${ownerUsername}`,
                    {
                        parse_mode: "Markdown"
                    }
                );
            }

            try {
                const result =
                    licenseManager.activate(
                        code,
                        uid
                    );

                if (!result.ok) {
                    const reasons = {
                        invalid: "License code does not exist.",
                        inactive: "This license has been revoked.",
                        expired: "This license has expired.",
                        used: "This license is already being used by another Telegram account."
                    };

                    return send(
                        chatId,
`❌ *LICENSE DENIED*

${reasons[result.reason] || "License activation failed."}

👑 Owner: ${ownerUsername}`,
                        {
                            parse_mode: "Markdown"
                        }
                    );
                }

                const license =
                    result.license;

                const expires =
                    license.expiresAt
                        ? new Date(
                            license.expiresAt
                        ).toLocaleString()
                        : "Never";

                return send(
                    chatId,
`╭━━〔 🔐 LICENSE ACTIVATED 〕━━⬣
┃
┃ ✅ Status : ACTIVE
┃
┃ 🔑 Code : \`${license.code}\`
┃
┃ ⏳ Duration : ${license.duration}
┃
┃ 📅 Expires : ${expires}
┃
╰━━━━━━━━━━━━━━━━⬣

👑 Owner: ${ownerUsername}`,
                    {
                        parse_mode: "Markdown"
                    }
                );

            } catch (err) {
                console.log(
                    "ACTIVATE ERROR:",
                    err?.message || err
                );

                return send(
                    chatId,
                    `❌ Activation failed.\n\n${err?.message || err}`
                );
            }
        }
    );

    // =========================================================
    // /STATUS
    // =========================================================

    bot.onText(/^\/status(?:@\w+)?$/i, async msg => {
        const uid = String(msg.from.id);

        const access =
            licenseManager.checkAccess(uid);

        const st =
            sessionManager.getStatus(uid);

        await send(
            msg.chat.id,
`🐍 *VENOM X STATUS*

License: ${
    access.active
        ? "ACTIVE"
        : access.expired
            ? "EXPIRED"
            : "NOT ACTIVE"
}

WhatsApp: ${
    st.connected
        ? "CONNECTED"
        : "NOT CONNECTED"
}

Sessions: ${st.sessions.length}

👑 Owner: ${ownerUsername}`,
            {
                parse_mode: "Markdown"
            }
        );
    });

    // =========================================================
    // /NUMBERS
    // =========================================================

    bot.onText(/^\/numbers(?:@\w+)?$/i, async msg => {
        const uid = String(msg.from.id);

        const access =
            licenseManager.checkAccess(uid);

        if (!access.active) {
            return send(
                msg.chat.id,
                licenseRequiredText(),
                {
                    parse_mode: "Markdown"
                }
            );
        }

        try {
            const numbers =
                sessionManager.getAllSessions(uid) || [];

            if (!numbers.length) {
                return send(
                    msg.chat.id,
                    `📱 You have no WhatsApp sessions.\n\n👑 Owner: ${ownerUsername}`
                );
            }

            const text =
                numbers
                    .map((s, i) => {
                        return `${i + 1}. ${maskPhone(
                            s.phoneNumber
                        )} — ${s.status}`;
                    })
                    .join("\n");

            await send(
                msg.chat.id,
`📱 *YOUR VENOM X NUMBERS*

${text}

👑 Owner: ${ownerUsername}`,
                {
                    parse_mode: "Markdown"
                }
            );

        } catch (err) {
            await send(
                msg.chat.id,
                `❌ Could not load numbers: ${
                    err?.message || err
                }`
            );
        }
    });

    // =========================================================
    // /DISCONNECT
    // =========================================================

    bot.onText(/^\/disconnect(?:@\w+)?$/i, async msg => {
        const uid = String(msg.from.id);

        try {
            await sessionManager.disconnectUser(
                uid,
                {
                    wipeAuth: false
                }
            );

            await send(
                msg.chat.id,
                `✅ WhatsApp sessions disconnected.

🔐 Auth data was kept.

👑 Owner: ${ownerUsername}`
            );

        } catch (err) {
            await send(
                msg.chat.id,
                `❌ Disconnect failed: ${
                    err?.message || err
                }`
            );
        }
    });

    // =========================================================
    // /UNPAIR
    // =========================================================

    bot.onText(
        /^\/unpair(?:@\w+)?(?:\s+(.+))?$/i,
        async (msg, match) => {
            const uid = String(msg.from.id);
            const chatId = msg.chat.id;

            const phoneRaw =
                match && match[1]
                    ? String(match[1]).trim()
                    : "";

            if (!phoneRaw) {
                return send(
                    chatId,
`❌ *Missing WhatsApp number*

Usage:

\`/unpair 2349163743900\`

This permanently removes the saved WhatsApp session.

👑 Owner: ${ownerUsername}`,
                    {
                        parse_mode: "Markdown"
                    }
                );
            }

            let phone;

            try {
                phone =
                    sessionManager.sanitizePhone(
                        phoneRaw
                    );
            } catch {
                return send(
                    chatId,
`❌ Invalid WhatsApp number.

Example:

\`/unpair 2349163743900\`

👑 Owner: ${ownerUsername}`,
                    {
                        parse_mode: "Markdown"
                    }
                );
            }

            try {
                const session =
                    sessionManager.getSession(
                        uid,
                        phone
                    );

                if (!session) {
                    return send(
                        chatId,
`❌ No active session found for +${phone}.

The saved session may already be removed.

👑 Owner: ${ownerUsername}`
                    );
                }

                await sessionManager.disconnectUserPhone(
                    uid,
                    phone,
                    {
                        wipeAuth: true
                    }
                );

                return send(
                    chatId,
`╭━━〔 🗑️ SESSION UNPAIRED 〕━━⬣
┃
┃ 📱 Number : +${phone}
┃
┃ 🔌 Status : DISCONNECTED
┃
┃ 🗑️ Auth : DELETED
┃
┃ 🔐 Session : REMOVED
┃
┃ 🔄 Pair again : /pair
╰━━━━━━━━━━━━━━━━⬣

👑 Owner: ${ownerUsername}`
                );

            } catch (err) {
                console.log(
                    "UNPAIR ERROR:",
                    err?.message || err
                );

                return send(
                    chatId,
`❌ *UNPAIR FAILED*

${err?.message || err}

👑 Owner: ${ownerUsername}`,
                    {
                        parse_mode: "Markdown"
                    }
                );
            }
        }
    );

    // =========================================================
    // /PAIR
    // =========================================================

    bot.onText(
        /^\/pair(?:@\w+)?(?:\s+(.+))?$/i,
        async (msg, match) => {
            const uid = String(msg.from.id);
            const chatId = msg.chat.id;

            const access =
                licenseManager.checkAccess(uid);

            if (!access.active) {
                return send(
                    chatId,
                    licenseRequiredText(),
                    {
                        parse_mode: "Markdown"
                    }
                );
            }

            const maybeNumber =
                match && match[1]
                    ? match[1].trim()
                    : null;

            const existing =
                sessionManager.getAllSessions(uid);

            const active =
                existing.find(
                    s =>
                        s.status === "connected" ||
                        s.status === "connecting"
                );

            if (active) {
                return send(
                    chatId,
`⚠️ You already have an active session.

Number: ${maskPhone(
    active.phoneNumber
)}

Use:

\`/unpair ${active.phoneNumber}\`

to completely remove it.

👑 Owner: ${ownerUsername}`,
                    {
                        parse_mode: "Markdown"
                    }
                );
            }

            if (
                maybeNumber &&
                isValidPhone(maybeNumber)
            ) {
                return startPair(
                    uid,
                    chatId,
                    maybeNumber
                );
            }

            waitingNumber.set(
                uid,
                true
            );

            await send(
                chatId,
`📞 *Send your WhatsApp number*

Country code required.
Do not use +.

Example:

\`2348160000000\`

👑 Owner: ${ownerUsername}`,
                {
                    parse_mode: "Markdown"
                }
            );
        }
    );

    // =========================================================
    // OWNER — /GENKEY
    // /genkey 1week
    // /genkey 2weeks
    // /genkey 1month
    // /genkey unlimited
    //
    // /gen remains an alias.
    // =========================================================

    bot.onText(
        /^\/(?:genkey|gen)(?:@\w+)?(?:\s+(.+))?$/i,
        async (msg, match) => {
            const chatId = msg.chat.id;
            const uid = String(msg.from.id);

            if (!isOwner(uid)) {
                return send(
                    chatId,
                    "❌ Owner only."
                );
            }

            const durationRaw =
                match && match[1]
                    ? String(match[1])
                        .trim()
                        .toLowerCase()
                    : "";

            if (!durationRaw) {
                return send(
                    chatId,
                    durationHelp(),
                    {
                        parse_mode: "Markdown"
                    }
                );
            }

            const aliases = {
                "1w": "1week",
                "week": "1week",
                "1week": "1week",
                "2w": "2weeks",
                "2week": "2weeks",
                "2weeks": "2weeks",
                "1m": "1month",
                "month": "1month",
                "1month": "1month",
                "unlimited": "unlimited",
                "forever": "unlimited"
            };

            const duration =
                aliases[durationRaw];

            if (!duration) {
                return send(
                    chatId,
`❌ Unknown duration: \`${durationRaw}\`

${durationHelp()}`,
                    {
                        parse_mode: "Markdown"
                    }
                );
            }

            try {
                const result =
                    licenseManager.createCode(
                        duration
                    );

                const code =
                    result?.code;

                if (!code) {
                    throw new Error(
                        "License manager did not return a code."
                    );
                }

                await send(
                    chatId,
`╭━━〔 🔑 VENOM X KEY GENERATED 〕━━⬣
┃
┃ 🔐 Code :
┃ \`${code}\`
┃
┃ ⏳ Duration :
┃ ${duration}
┃
┃ 📱 Access :
┃ One Telegram account
┃
╰━━━━━━━━━━━━━━━━⬣

📤 Give this code to the connector.

👑 Owner: ${ownerUsername}`,
                    {
                        parse_mode: "Markdown"
                    }
                );

            } catch (err) {
                console.log(
                    "License generation error:",
                    err?.message || err
                );

                await send(
                    chatId,
`❌ License generation failed.

${err?.message || err}`
                );
            }
        }
    );

    // =========================================================
    // OWNER — /REVOKE
    // =========================================================

    bot.onText(
        /^\/revoke(?:@\w+)?(?:\s+(.+))?$/i,
        async (msg, match) => {
            const chatId = msg.chat.id;
            const uid = String(msg.from.id);

            if (!isOwner(uid)) {
                return send(
                    chatId,
                    "❌ Owner only."
                );
            }

            const code =
                match && match[1]
                    ? String(match[1])
                        .trim()
                        .toUpperCase()
                    : "";

            if (!code) {
                return send(
                    chatId,
`❌ *Missing license code*

Usage:

\`/revoke VX-XXXXXX-XXXXXX\``,
                    {
                        parse_mode: "Markdown"
                    }
                );
            }

            try {
                const result =
                    licenseManager.revokeCode(
                        code
                    );

                if (result === false) {
                    return send(
                        chatId,
`❌ *LICENSE NOT FOUND*

Code:
\`${code}\``,
                        {
                            parse_mode: "Markdown"
                        }
                    );
                }

                return send(
                    chatId,
`╭━━〔 🔐 LICENSE REVOKED 〕━━⬣
┃
┃ ✅ Code : \`${code}\`
┃
┃ 🔒 Status : REVOKED
┃
┃ 🚫 New access : BLOCKED
╰━━━━━━━━━━━━━━━━⬣

👑 Owner: ${ownerUsername}`,
                    {
                        parse_mode: "Markdown"
                    }
                );

            } catch (err) {
                console.log(
                    "REVOKE ERROR:",
                    err?.message || err
                );

                return send(
                    chatId,
`❌ *REVOCATION FAILED*

${err?.message || err}`
                );
            }
        }
    );

    // =========================================================
    // OWNER — /LICENSES
    // =========================================================

    bot.onText(
        /^\/licenses(?:@\w+)?$/i,
        async msg => {
            const uid = String(msg.from.id);

            if (!isOwner(uid)) {
                return send(
                    msg.chat.id,
                    "❌ Owner only."
                );
            }

            try {
                const list =
                    licenseManager.listCodes();

                if (
                    !Array.isArray(list) ||
                    !list.length
                ) {
                    return send(
                        msg.chat.id,
                        "📭 No licenses found."
                    );
                }

                const text =
                    list
                        .map((x, i) => {
                            let status =
                                "ACTIVE";

                            if (!x.active) {
                                status =
                                    "REVOKED";
                            } else if (
                                x.expiresAt &&
                                Date.now() >=
                                    x.expiresAt
                            ) {
                                status =
                                    "EXPIRED";
                            }

                            return (
`${i + 1}. ${x.code || "UNKNOWN"}
   Status: ${status}
   Duration: ${x.duration || "-"}
   Used by: ${x.usedBy || "Not used"}`
                            );
                        })
                        .join("\n\n");

                await send(
                    msg.chat.id,
`🔐 *VENOM X LICENSES*

${text}`,
                    {
                        parse_mode: "Markdown"
                    }
                );

            } catch (err) {
                await send(
                    msg.chat.id,
                    `❌ ${err?.message || err}`
                );
            }
        }
    );

    // =========================================================
    // OWNER — /USERS
    // =========================================================

    bot.onText(
        /^\/users(?:@\w+)?$/i,
        async msg => {
            if (!isOwner(msg.from.id)) {
                return;
            }

            const list =
                sessionManager.listActiveSessions();

            if (!list.length) {
                return send(
                    msg.chat.id,
                    "👥 No active sessions."
                );
            }

            const text =
                list
                    .map(
                        s =>
                            `• ${s.telegramUserId} | ${s.status} | ${s.phoneNumber || "-"}`
                    )
                    .join("\n");

            await send(
                msg.chat.id,
`👑 *ACTIVE VENOM X SESSIONS*

${text}`,
                {
                    parse_mode: "Markdown"
                }
            );
        }
    );

    // =========================================================
    // OWNER — /STOPALL
    // =========================================================

    bot.onText(
        /^\/stopall(?:@\w+)?$/i,
        async msg => {
            if (!isOwner(msg.from.id)) {
                return;
            }

            const list =
                sessionManager.listActiveSessions();

            for (const s of list) {
                try {
                    await sessionManager.disconnectUser(
                        s.telegramUserId,
                        {
                            wipeAuth: false
                        }
                    );
                } catch {}
            }

            await send(
                msg.chat.id,
                `🛑 Stopped ${list.length} session(s).`
            );
        }
    );

    // =========================================================
    // CALLBACK BUTTONS
    // =========================================================

    bot.on(
        "callback_query",
        async q => {
            try {
                const uid =
                    String(q.from.id);

                const chatId =
                    q.message?.chat?.id;

                const data =
                    q.data;

                if (!chatId) return;

                try {
                    await bot.answerCallbackQuery(
                        q.id
                    );
                } catch {}

                if (data === "pair") {
                    const access =
                        licenseManager.checkAccess(
                            uid
                        );

                    if (!access.active) {
                        return send(
                            chatId,
                            licenseRequiredText(),
                            {
                                parse_mode: "Markdown"
                            }
                        );
                    }

                    const existing =
                        sessionManager.getAllSessions(
                            uid
                        );

                    const active =
                        existing.find(
                            s =>
                                s.status === "connected" ||
                                s.status === "connecting"
                        );

                    if (active) {
                        return send(
                            chatId,
`⚠️ Active session exists.

Use:

\`/unpair ${active.phoneNumber}\`

to completely remove it.

👑 Owner: ${ownerUsername}`,
                            {
                                parse_mode: "Markdown"
                            }
                        );
                    }

                    waitingNumber.set(
                        uid,
                        true
                    );

                    return send(
                        chatId,
`📞 *Send your WhatsApp number*

Example:
\`2348160000000\`

👑 Owner: ${ownerUsername}`,
                        {
                            parse_mode: "Markdown"
                        }
                    );
                }

                if (data === "status") {
                    const st =
                        sessionManager.getStatus(
                            uid
                        );

                    return send(
                        chatId,
`🐍 *VENOM X STATUS*

WhatsApp: ${
    st.connected
        ? "CONNECTED"
        : "NOT CONNECTED"
}

Sessions: ${st.sessions.length}

👑 Owner: ${ownerUsername}`,
                        {
                            parse_mode: "Markdown"
                        }
                    );
                }

                if (data === "numbers") {
                    const numbers =
                        sessionManager.getAllSessions(
                            uid
                        );

                    if (!numbers.length) {
                        return send(
                            chatId,
                            `📱 No WhatsApp sessions.\n\n👑 Owner: ${ownerUsername}`
                        );
                    }

                    const text =
                        numbers
                            .map(
                                (s, i) =>
                                    `${i + 1}. ${maskPhone(
                                        s.phoneNumber
                                    )} — ${s.status}`
                            )
                            .join("\n");

                    return send(
                        chatId,
`📱 *YOUR NUMBERS*

${text}

👑 Owner: ${ownerUsername}`,
                        {
                            parse_mode: "Markdown"
                        }
                    );
                }

                if (data === "disconnect") {
                    await sessionManager.disconnectUser(
                        uid,
                        {
                            wipeAuth: false
                        }
                    );

                    return send(
                        chatId,
                        `✅ WhatsApp sessions disconnected.

👑 Owner: ${ownerUsername}`
                    );
                }

                if (data === "help") {
                    return send(
                        chatId,
`ℹ️ *VENOM X*

Use /activate CODE to activate access.

Then use /pair to connect WhatsApp.

Use /unpair NUMBER to completely delete a saved WhatsApp session.

👑 Owner: ${ownerUsername}`,
                        {
                            parse_mode: "Markdown"
                        }
                    );
                }

            } catch (err) {
                console.log(
                    "callback error:",
                    err?.message || err
                );
            }
        }
    );

    // =========================================================
    // NUMBER INPUT
    // =========================================================

    bot.on(
        "message",
        async msg => {
            try {
                if (!msg.text) return;

                if (
                    msg.text.startsWith("/")
                ) {
                    return;
                }

                const uid =
                    String(msg.from.id);

                if (
                    !waitingNumber.get(uid)
                ) {
                    return;
                }

                const phone =
                    normalizePhone(
                        msg.text
                    );

                if (!phone) {
                    return send(
                        msg.chat.id,
                        `❌ Invalid number.

Example: \`2348160000000\`

👑 Owner: ${ownerUsername}`,
                        {
                            parse_mode: "Markdown"
                        }
                    );
                }

                waitingNumber.delete(
                    uid
                );

                await startPair(
                    uid,
                    msg.chat.id,
                    phone
                );

            } catch (err) {
                console.log(
                    "message handler error:",
                    err?.message || err
                );
            }
        }
    );

    // =========================================================
    // POLLING ERRORS
    // =========================================================

    bot.on(
        "polling_error",
        err => {
            console.log(
                "Telegram polling error:",
                err?.message || err
            );
        }
    );

    console.log(
        "📱 VENOM X Telegram bot started"
    );

    return bot;
}

module.exports = {
    startTelegramBot
};
