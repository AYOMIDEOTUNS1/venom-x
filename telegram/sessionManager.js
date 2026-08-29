const fs = require("fs");
const path = require("path");
const pino = require("pino");

const baileys = require("@whiskeysockets/baileys");
const makeWASocket = baileys.default;
const DisconnectReason = baileys.DisconnectReason;
const useMultiFileAuthState = baileys.useMultiFileAuthState;
const fetchLatestBaileysVersion = baileys.fetchLatestBaileysVersion;
const makeCacheableSignalKeyStore = baileys.makeCacheableSignalKeyStore;
const Browsers = baileys.Browsers;

const logger = pino({ level: "silent" });
const SESSIONS_ROOT = path.join(process.cwd(), "sessions");

if (!fs.existsSync(SESSIONS_ROOT)) {
    fs.mkdirSync(SESSIONS_ROOT, { recursive: true });
}

const sessions = new Map();

function sanitizeUserId(id) {
    const value = String(id || "").replace(/\D/g, "");
    if (!value || value.length < 3) throw new Error("Invalid Telegram user id");
    return value;
}

function sanitizePhone(phone) {
    const value = String(phone || "").replace(/\D/g, "");
    if (value.length < 8 || value.length > 15) throw new Error("Invalid phone number");
    return value;
}

function userRoot(userId) {
    return path.join(SESSIONS_ROOT, sanitizeUserId(userId));
}

function phonePath(userId, phone) {
    return path.join(userRoot(userId), sanitizePhone(phone));
}

function getUserSessions(userId) {
    const uid = sanitizeUserId(userId);
    if (!sessions.has(uid)) sessions.set(uid, new Map());
    return sessions.get(uid);
}

function getSession(userId, phone) {
    try {
        return getUserSessions(userId).get(sanitizePhone(phone)) || null;
    } catch (e) {
        return null;
    }
}

function getAllSessions(userId) {
    try {
        return Array.from(getUserSessions(userId).values());
    } catch (e) {
        return [];
    }
}

function sleep(ms) {
    return new Promise(function (resolve) {
        setTimeout(resolve, ms);
    });
}

function authExists(userId, phone) {
    try {
        const dir = phonePath(userId, phone);
        if (!fs.existsSync(dir)) return false;
        return fs.readdirSync(dir).length > 0;
    } catch (e) {
        return false;
    }
}

function removeAuth(userId, phone) {
    const dir = phonePath(userId, phone);
    try {
        fs.rmSync(dir, { recursive: true, force: true });
        return true;
    } catch (err) {
        console.log("[" + userId + "/" + phone + "] auth removal error:", err && err.message ? err.message : err);
        return false;
    }
}

async function killSessionObject(session, reason) {
    if (!session) return;

    session.activeGeneration = (session.generation || 0) + 1;
    session.pairingInProgress = false;

    if (session.reconnectTimer) {
        clearTimeout(session.reconnectTimer);
        session.reconnectTimer = null;
    }

    const sock = session.sock;
    session.sock = null;
    session.status = "inactive";
    session.handlersLoadedFor = null;

    if (sock) {
        try { sock.ev.removeAllListeners(); } catch (e) {}
        try { sock.end(new Error(reason || "session killed")); } catch (e) {}
        await sleep(400);
    }
}

async function loadHandlers(sock, session) {
    if (!sock || !sock.ev) return;
    if (session.handlersLoadedFor === sock) return;
    if (session.sock !== sock) return;
    if (session.generation !== session.activeGeneration) return;

    try {
        delete require.cache[require.resolve("../handlers/messages")];
        delete require.cache[require.resolve("../handlers/welcome")];

        const messages = require("../handlers/messages");
        if (typeof messages === "function") messages(sock);

        const welcome = require("../handlers/welcome");
        if (typeof welcome === "function") {
            sock.ev.on("group-participants.update", async function (update) {
                if (session.sock !== sock) return;
                if (session.generation !== session.activeGeneration) return;
                try {
                    await welcome(sock, update);
                } catch (err) {
                    console.log(
                        "[" + session.telegramUserId + "/" + session.phoneNumber + "] welcome error:",
                        err && err.message ? err.message : err
                    );
                }
            });
        }

        session.handlersLoadedFor = sock;
        console.log("[" + session.telegramUserId + "/" + session.phoneNumber + "] handlers loaded");
    } catch (err) {
        session.handlersLoadedFor = null;
        console.log(
            "[" + session.telegramUserId + "/" + session.phoneNumber + "] handler error:",
            err && err.message ? err.message : err
        );
    }
}

async function requestPairingCode(sock, session) {
    const started = Date.now();
    let lastError = null;

    while (Date.now() - started < 20000) {
        if (session.sock !== sock) throw new Error("Session replaced");
        if (session.generation !== session.activeGeneration) throw new Error("Session replaced");

        try {
            const code = await sock.requestPairingCode(session.phoneNumber);
            if (code) return String(code);
        } catch (err) {
            lastError = err;
            const message = String(err && err.message ? err.message : err).toLowerCase();
            if (
                message.indexOf("connection closed") !== -1 ||
                message.indexOf("not connected") !== -1 ||
                message.indexOf("closed") !== -1 ||
                message.indexOf("timeout") !== -1
            ) {
                await sleep(1200);
                continue;
            }
            throw err;
        }
        await sleep(1200);
    }

    throw lastError || new Error("Pairing code timeout");
}

function scheduleReconnect(session, uid, phone, notify, delayMs) {
    if (session.reconnectTimer) return;

    session.reconnectTimer = setTimeout(async function () {
        session.reconnectTimer = null;
        if (session.generation !== session.activeGeneration) return;

        const current = getSession(uid, phone);
        if (current && current.sock) return;

        try {
            if (notify) {
                try { await notify("Reconnecting +" + phone + "..."); } catch (e) {}
            }
            await createSocket(uid, phone, notify, 0);
        } catch (err) {
            console.log("[" + uid + "/" + phone + "] reconnect error:", err && err.message ? err.message : err);
        }
    }, delayMs || 4000);
}

async function createSocket(userId, phoneNumber, notify, retryCount) {
    retryCount = retryCount || 0;

    const uid = sanitizeUserId(userId);
    const phone = sanitizePhone(phoneNumber);
    const userSessions = getUserSessions(uid);
    const existing = userSessions.get(phone);

    if (existing && (existing.status === "connecting" || existing.status === "connected") && !existing.pairingInProgress) {
        throw new Error("+" + phone + " already has an active session.");
    }

    if (existing) {
        await killSessionObject(existing, "replaced");
        userSessions.delete(phone);
    }

    const authDir = phonePath(uid, phone);
    fs.mkdirSync(authDir, { recursive: true });

    const generation = ((existing && existing.generation) || 0) + 1;

    const session = {
        telegramUserId: uid,
        phoneNumber: phone,
        status: "connecting",
        sock: null,
        generation: generation,
        activeGeneration: generation,
        handlersLoadedFor: null,
        reconnectTimer: null,
        notify: typeof notify === "function" ? notify : null,
        registered: false,
        pairingInProgress: false,
        badSessionTries: (existing && existing.badSessionTries) || 0
    };

    userSessions.set(phone, session);

    let state;
    let saveCreds;

    try {
        const authState = await useMultiFileAuthState(authDir);
        state = authState.state;
        saveCreds = authState.saveCreds;
    } catch (err) {
        userSessions.delete(phone);
        throw err;
    }

    session.registered = Boolean(state.creds && state.creds.registered);

    let version;
    try {
        version = (await fetchLatestBaileysVersion()).version;
    } catch (e) {
        version = [2, 3000, 1015901307];
    }

    let browser;
    try {
        browser = Browsers.ubuntu("Chrome");
    } catch (e) {
        browser = ["Ubuntu", "Chrome", "22.04.4"];
    }

    const sock = makeWASocket({
        version: version,
        logger: logger,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, logger)
        },
        browser: browser,
        printQRInTerminal: false,
        syncFullHistory: false,
        fireInitQueries: false,
        markOnlineOnConnect: false,
        generateHighQualityLinkPreview: false,
        connectTimeoutMs: 60000,
        keepAliveIntervalMs: 30000,
        retryRequestDelayMs: 500
    });

    session.sock = sock;

    sock.ev.on("creds.update", async function () {
        try {
            await saveCreds();
            session.registered = Boolean(state.creds && state.creds.registered);
        } catch (e) {}
    });

    sock.ev.on("connection.update", async function (update) {
        if (session.sock !== sock) return;
        if (session.generation !== session.activeGeneration) return;

        const connection = update.connection;
        const lastDisconnect = update.lastDisconnect;

        if (connection === "open") {
            session.status = "connected";
            session.registered = true;
            session.pairingInProgress = false;
            session.badSessionTries = 0;

            await loadHandlers(sock, session);

            if (session.notify) {
                try {
                    await session.notify("VENOM X CONNECTED\n\nNumber: +" + phone + "\nSession: ACTIVE");
                } catch (e) {}
            }

            console.log("[" + uid + "/" + phone + "] WhatsApp connected");
            return;
        }

        if (connection === "close") {
            let statusCode = 0;
            try {
                statusCode =
                    (lastDisconnect && lastDisconnect.error && lastDisconnect.error.output && lastDisconnect.error.output.statusCode) ||
                    (lastDisconnect && lastDisconnect.error && lastDisconnect.error.statusCode) ||
                    0;
            } catch (e) {}

            console.log("[" + uid + "/" + phone + "] connection closed:", statusCode);

            if (session.generation !== session.activeGeneration) return;

            const nowRegistered = Boolean(state.creds && state.creds.registered);
            session.registered = nowRegistered;

            session.status = "disconnected";
            session.handlersLoadedFor = null;
            if (session.sock === sock) session.sock = null;

            // Paired OK, WhatsApp restart required
            if (nowRegistered && (statusCode === 515 || statusCode === DisconnectReason.restartRequired)) {
                session.pairingInProgress = false;
                console.log("[" + uid + "/" + phone + "] paired OK, restarting socket...");
                scheduleReconnect(session, uid, phone, session.notify, 2500);
                return;
            }

            // Not registered yet (pairing phase)
            if (!nowRegistered) {
                userSessions.delete(phone);

                if ((statusCode === 428 || statusCode === 408 || statusCode === 515) && retryCount < 2) {
                    console.log("[" + uid + "/" + phone + "] pairing retry " + (retryCount + 1));
                    if (session.notify) {
                        try {
                            await session.notify("Pairing channel closed (" + statusCode + "). Retrying " + (retryCount + 1) + "/2...");
                        } catch (e) {}
                    }
                    await sleep(2500);
                    try {
                        await createSocket(uid, phone, notify, retryCount + 1);
                        return;
                    } catch (e) {}
                }

                if (session.notify) {
                    try {
                        await session.notify(
                            "Pairing session closed for +" + phone +
                            "\nStatus: " + statusCode +
                            "\n\nTry /pair again."
                        );
                    } catch (e) {}
                }
                return;
            }

            // Logged out
            if (statusCode === DisconnectReason.loggedOut || statusCode === 401) {
                removeAuth(uid, phone);
                userSessions.delete(phone);
                if (session.notify) {
                    try {
                        await session.notify("WHATSAPP LOGGED OUT\n\nNumber: +" + phone + "\n\nUse /pair again.");
                    } catch (e) {}
                }
                return;
            }

            // Bad session 500: soft reconnect once, then wipe
            if (statusCode === DisconnectReason.badSession || statusCode === 500) {
                session.badSessionTries = (session.badSessionTries || 0) + 1;

                if (session.badSessionTries <= 1) {
                    console.log("[" + uid + "/" + phone + "] badSession 500 — soft reconnect");
                    scheduleReconnect(session, uid, phone, session.notify, 3000);
                    return;
                }

                console.log("[" + uid + "/" + phone + "] badSession 500 — wiping auth");
                removeAuth(uid, phone);
                userSessions.delete(phone);
                if (session.notify) {
                    try {
                        await session.notify("BAD SESSION\n\nNumber: +" + phone + "\n\nUse /pair again.");
                    } catch (e) {}
                }
                return;
            }

            // Normal reconnectable closes
            if (
                statusCode === DisconnectReason.connectionLost ||
                statusCode === DisconnectReason.timedOut ||
                statusCode === DisconnectReason.connectionClosed ||
                statusCode === DisconnectReason.restartRequired ||
                statusCode === DisconnectReason.unavailableService ||
                statusCode === 408 ||
                statusCode === 440 ||
                statusCode === 428 ||
                statusCode === 515
            ) {
                scheduleReconnect(session, uid, phone, session.notify, 4000);
            }
        }
    });

    if (!state.creds.registered) {
        session.pairingInProgress = true;
        await sleep(8000);

        if (session.sock !== sock) return session;
        if (session.generation !== session.activeGeneration) return session;

        try {
            console.log("[" + uid + "/" + phone + "] requesting pairing code");
            const code = await requestPairingCode(sock, session);

            if (session.sock !== sock) {
                throw new Error("Socket closed before pairing completed");
            }

            if (session.notify) {
                try {
                    await session.notify(
                        "VENOM X PAIRING CODE\n\nNumber: +" +
                        phone +
                        "\nCode: " +
                        code +
                        "\n\nOPEN WHATSAPP NOW\nLinked Devices -> Link with phone number\nENTER CODE IMMEDIATELY"
                    );
                } catch (e) {}
            }

            console.log("[" + uid + "/" + phone + "] pairing code: " + code);
        } catch (err) {
            session.pairingInProgress = false;
            session.status = "error";
            await killSessionObject(session, "pairing failed");
            userSessions.delete(phone);
            if (!state.creds.registered) removeAuth(uid, phone);

            if (session.notify) {
                try {
                    await session.notify(
                        "PAIRING FAILED\n\nNumber: +" + phone + "\n\n" + (err && err.message ? err.message : String(err))
                    );
                } catch (e) {}
            }
            throw err;
        }
    } else {
        console.log("[" + uid + "/" + phone + "] using saved session");
    }

    return session;
}

async function disconnectUserPhone(userId, phoneNumber, options) {
    options = options || {};
    const wipeAuth = options.wipeAuth === true;
    const uid = sanitizeUserId(userId);
    const phone = sanitizePhone(phoneNumber);
    const userSessions = getUserSessions(uid);
    const session = userSessions.get(phone);

    if (session) {
        await killSessionObject(session, "user unpair");
        userSessions.delete(phone);
    }

    const saved = authExists(uid, phone);
    if (wipeAuth) removeAuth(uid, phone);

    return {
        active: Boolean(session),
        saved: saved,
        removed: Boolean(session) || (wipeAuth && saved)
    };
}

async function disconnectUser(userId, options) {
    options = options || {};
    const wipeAuth = options.wipeAuth === true;
    const uid = sanitizeUserId(userId);
    const active = getAllSessions(uid);

    for (let i = 0; i < active.length; i++) {
        await disconnectUserPhone(uid, active[i].phoneNumber, { wipeAuth: wipeAuth });
    }

    if (wipeAuth) {
        try {
            const root = userRoot(uid);
            if (fs.existsSync(root)) fs.rmSync(root, { recursive: true, force: true });
        } catch (e) {}
    }

    return active.length > 0;
}

async function unpairUserPhone(userId, phoneNumber) {
    return disconnectUserPhone(userId, phoneNumber, { wipeAuth: true });
}

function getStatus(userId) {
    const uid = sanitizeUserId(userId);
    const list = getAllSessions(uid);
    return {
        connected: list.some(function (s) { return s.status === "connected"; }),
        status: list.length ? "ACTIVE" : "INACTIVE",
        sessions: list.map(function (s) {
            return {
                phoneNumber: s.phoneNumber,
                status: s.status,
                connected: s.status === "connected",
                saved: authExists(uid, s.phoneNumber)
            };
        })
    };
}

function listSavedSessions(userId) {
    const uid = sanitizeUserId(userId);
    const root = userRoot(uid);
    if (!fs.existsSync(root)) return [];
    try {
        return fs.readdirSync(root, { withFileTypes: true })
            .filter(function (e) { return e.isDirectory(); })
            .map(function (e) { return e.name; })
            .filter(function (phone) {
                try { sanitizePhone(phone); return true; } catch (e) { return false; }
            });
    } catch (e) {
        return [];
    }
}

function listActiveSessions() {
    const result = [];
    sessions.forEach(function (userMap, uid) {
        userMap.forEach(function (session, phone) {
            result.push({
                telegramUserId: uid,
                phoneNumber: phone,
                status: session.status,
                connected: session.status === "connected",
                saved: authExists(uid, phone)
            });
        });
    });
    return result;
}

function sessionPath(userId, phone) {
    return phonePath(userId, phone);
}

module.exports = {
    createSocket: createSocket,
    disconnectUser: disconnectUser,
    disconnectUserPhone: disconnectUserPhone,
    unpairUserPhone: unpairUserPhone,
    getStatus: getStatus,
    getSession: getSession,
    getAllSessions: getAllSessions,
    listActiveSessions: listActiveSessions,
    listSavedSessions: listSavedSessions,
    authExists: authExists,
    removeAuth: removeAuth,
    sanitizeUserId: sanitizeUserId,
    sanitizePhone: sanitizePhone,
    sessionPath: sessionPath
};
