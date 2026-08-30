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

const logger = pino({
    level: "silent"
});

const SESSIONS_ROOT = path.join(
    process.cwd(),
    "sessions"
);

if (!fs.existsSync(SESSIONS_ROOT)) {
    fs.mkdirSync(SESSIONS_ROOT, {
        recursive: true
    });
}

/*
|--------------------------------------------------------------------------
| IN-MEMORY SESSION REGISTRY
|--------------------------------------------------------------------------
|
| sessions:
|   Telegram user
|       └── WhatsApp number
|               └── session object
|
*/

const sessions = new Map();

/*
|--------------------------------------------------------------------------
| HELPERS
|--------------------------------------------------------------------------
*/

function sanitizeUserId(id) {
    const value = String(id || "").replace(/\D/g, "");

    if (!value || value.length < 3) {
        throw new Error("Invalid Telegram user id");
    }

    return value;
}

function sanitizePhone(phone) {
    const value = String(phone || "").replace(/\D/g, "");

    if (value.length < 8 || value.length > 15) {
        throw new Error("Invalid phone number");
    }

    return value;
}

function userRoot(userId) {
    return path.join(
        SESSIONS_ROOT,
        sanitizeUserId(userId)
    );
}

function phonePath(userId, phone) {
    return path.join(
        userRoot(userId),
        sanitizePhone(phone)
    );
}

function getUserSessions(userId) {
    const uid = sanitizeUserId(userId);

    if (!sessions.has(uid)) {
        sessions.set(uid, new Map());
    }

    return sessions.get(uid);
}

function getSession(userId, phone) {
    try {
        return (
            getUserSessions(userId).get(
                sanitizePhone(phone)
            ) || null
        );
    } catch (e) {
        return null;
    }
}

function getAllSessions(userId) {
    try {
        return Array.from(
            getUserSessions(userId).values()
        );
    } catch (e) {
        return [];
    }
}

function sleep(ms) {
    return new Promise(resolve => {
        setTimeout(resolve, ms);
    });
}

function authExists(userId, phone) {
    try {
        const dir = phonePath(
            userId,
            phone
        );

        if (!fs.existsSync(dir)) {
            return false;
        }

        return fs.readdirSync(dir).length > 0;
    } catch (e) {
        return false;
    }
}

function removeAuth(userId, phone) {
    const dir = phonePath(
        userId,
        phone
    );

    try {
        fs.rmSync(dir, {
            recursive: true,
            force: true
        });

        return true;
    } catch (err) {
        console.log(
            "[" +
                userId +
                "/" +
                phone +
                "] auth removal error:",
            err && err.message
                ? err.message
                : err
        );

        return false;
    }
}

/*
|--------------------------------------------------------------------------
| SESSION VALIDITY
|--------------------------------------------------------------------------
*/

function isCurrentSession(session, sock) {
    if (!session || !sock) {
        return false;
    }

    if (session.sock !== sock) {
        return false;
    }

    if (
        session.generation !==
        session.activeGeneration
    ) {
        return false;
    }

    return true;
}

/*
|--------------------------------------------------------------------------
| KILL SOCKET
|--------------------------------------------------------------------------
*/

async function killSessionObject(
    session,
    reason
) {
    if (!session) {
        return;
    }

    /*
     * Invalidate everything belonging to
     * the current socket immediately.
     */
    session.activeGeneration =
        (session.generation || 0) + 1;

    session.generation =
        session.activeGeneration;

    session.pairingInProgress = false;

    if (session.reconnectTimer) {
        clearTimeout(
            session.reconnectTimer
        );

        session.reconnectTimer = null;
    }

    const sock = session.sock;

    session.sock = null;
    session.status = "inactive";
    session.handlersLoadedFor = null;

    if (sock) {
        try {
            sock.ev.removeAllListeners();
        } catch (e) {}

        try {
            sock.end(
                new Error(
                    reason ||
                    "session killed"
                )
            );
        } catch (e) {}

        await sleep(300);
    }
}

/*
|--------------------------------------------------------------------------
| HANDLERS
|--------------------------------------------------------------------------
|
| IMPORTANT:
| Handlers are loaded only after the socket
| reaches connection === "open".
|
*/

async function loadHandlers(
    sock,
    session
) {
    if (!isCurrentSession(session, sock)) {
        return;
    }

    if (
        session.handlersLoadedFor ===
        sock
    ) {
        return;
    }

    try {
        const messagesPath =
            require.resolve(
                "../handlers/messages"
            );

        const welcomePath =
            require.resolve(
                "../handlers/welcome"
            );

        /*
         * Reload handlers so the active socket
         * gets a fresh handler set.
         */
        delete require.cache[
            messagesPath
        ];

        delete require.cache[
            welcomePath
        ];

        const messages =
            require(
                "../handlers/messages"
            );

        if (
            typeof messages ===
            "function"
        ) {
            messages(sock);
        }

        const welcome =
            require(
                "../handlers/welcome"
            );

        if (
            typeof welcome ===
            "function"
        ) {
            sock.ev.on(
                "group-participants.update",
                async update => {
                    if (
                        !isCurrentSession(
                            session,
                            sock
                        )
                    ) {
                        return;
                    }

                    try {
                        await welcome(
                            sock,
                            update
                        );
                    } catch (err) {
                        console.log(
                            "[" +
                                session.telegramUserId +
                                "/" +
                                session.phoneNumber +
                                "] welcome error:",
                            err &&
                            err.message
                                ? err.message
                                : err
                        );
                    }
                }
            );
        }

        session.handlersLoadedFor =
            sock;

        console.log(
            "[" +
                session.telegramUserId +
                "/" +
                session.phoneNumber +
                "] handlers loaded"
        );
    } catch (err) {
        session.handlersLoadedFor =
            null;

        console.log(
            "[" +
                session.telegramUserId +
                "/" +
                session.phoneNumber +
                "] handler error:",
            err && err.message
                ? err.message
                : err
        );
    }
}

/*
|--------------------------------------------------------------------------
| PAIRING CODE
|--------------------------------------------------------------------------
|
| requestPairingCode can be called while the
| socket is still connecting.
|
*/

async function requestPairingCode(
    sock,
    session
) {
    const started = Date.now();

    let lastError = null;

    while (
        Date.now() - started <
        30000
    ) {
        if (
            !isCurrentSession(
                session,
                sock
            )
        ) {
            throw new Error(
                "Session replaced"
            );
        }

        /*
         * If WhatsApp already registered the
         * credentials, no new pairing code
         * should be requested.
         */
        if (
            session.registered
        ) {
            throw new Error(
                "Session is already registered"
            );
        }

        try {
            const code =
                await sock.requestPairingCode(
                    session.phoneNumber
                );

            if (code) {
                return String(code);
            }
        } catch (err) {
            lastError = err;

            const message =
                String(
                    err &&
                    err.message
                        ? err.message
                        : err
                ).toLowerCase();

            /*
             * These errors commonly happen while
             * the WebSocket is still establishing.
             */
            if (
                message.includes(
                    "connection closed"
                ) ||
                message.includes(
                    "not connected"
                ) ||
                message.includes(
                    "closed"
                ) ||
                message.includes(
                    "timeout"
                ) ||
                message.includes(
                    "timed out"
                )
            ) {
                await sleep(1000);
                continue;
            }

            throw err;
        }

        await sleep(1000);
    }

    throw (
        lastError ||
        new Error(
            "Pairing code timeout"
        )
    );
}

/*
|--------------------------------------------------------------------------
| RECONNECT
|--------------------------------------------------------------------------
|
| Critical protection:
|
| The reconnect timer belongs to a specific
| session object.
|
| If another socket replaces that session,
| the timer becomes invalid and does nothing.
|
*/

function scheduleReconnect(
    session,
    uid,
    phone,
    notify,
    delayMs
) {
    if (!session) {
        return;
    }

    if (session.reconnectTimer) {
        return;
    }

    const expectedSession =
        session;

    session.reconnectTimer =
        setTimeout(
            async function () {
                session.reconnectTimer =
                    null;

                /*
                 * Make sure the exact same session
                 * is still registered.
                 */
                const current =
                    getSession(
                        uid,
                        phone
                    );

                if (
                    current !==
                    expectedSession
                ) {
                    return;
                }

                /*
                 * Another socket already replaced
                 * this one.
                 */
                if (
                    current.sock
                ) {
                    return;
                }

                if (
                    current.status ===
                    "connecting"
                ) {
                    return;
                }

                /*
                 * Invalidate the old generation
                 * before creating the new socket.
                 */
                current.activeGeneration =
                    (current.generation ||
                        0) + 1;

                current.generation =
                    current.activeGeneration;

                try {
                    if (notify) {
                        try {
                            await notify(
                                "Reconnecting +" +
                                    phone +
                                    "..."
                            );
                        } catch (e) {}
                    }

                    await createSocket(
                        uid,
                        phone,
                        notify,
                        0
                    );
                } catch (err) {
                    console.log(
                        "[" +
                            uid +
                            "/" +
                            phone +
                            "] reconnect error:",
                        err &&
                        err.message
                            ? err.message
                            : err
                    );

                    /*
                     * Only retry if this is still
                     * the current session.
                     */
                    const latest =
                        getSession(
                            uid,
                            phone
                        );

                    if (
                        latest ===
                        expectedSession &&
                        !latest.sock
                    ) {
                        latest.status =
                            "disconnected";

                        scheduleReconnect(
                            latest,
                            uid,
                            phone,
                            latest.notify,
                            8000
                        );
                    }
                }
            },
            delayMs || 4000
        );
}

/*
|--------------------------------------------------------------------------
| CREATE SOCKET
|--------------------------------------------------------------------------
*/

async function createSocket(
    userId,
    phoneNumber,
    notify,
    retryCount
) {
    retryCount =
        Number.isInteger(
            retryCount
        )
            ? retryCount
            : 0;

    const uid =
        sanitizeUserId(
            userId
        );

    const phone =
        sanitizePhone(
            phoneNumber
        );

    const userSessions =
        getUserSessions(uid);

    const existing =
        userSessions.get(phone);

    /*
     * Never create a second socket for the
     * same Telegram user + WhatsApp number.
     */
    if (
        existing &&
        (
            existing.status ===
                "connecting" ||
            existing.status ===
                "connected"
        )
    ) {
        /*
         * A pairing request is already running.
         */
        if (
            existing.pairingInProgress
        ) {
            throw new Error(
                "+" +
                    phone +
                    " is already being paired."
            );
        }

        throw new Error(
            "+" +
                phone +
                " already has an active session."
        );
    }

    /*
     * If an old disconnected/error session
     * exists, invalidate it first.
     */
    if (existing) {
        await killSessionObject(
            existing,
            "replaced"
        );

        /*
         * Only delete it if it is still the
         * exact object in the registry.
         */
        if (
            userSessions.get(
                phone
            ) === existing
        ) {
            userSessions.delete(
                phone
            );
        }
    }

    const authDir =
        phonePath(
            uid,
            phone
        );

    fs.mkdirSync(
        authDir,
        {
            recursive: true
        }
    );

    const generation =
        existing &&
        existing.generation
            ? existing.generation +
              1
            : 1;

    const session = {
        telegramUserId: uid,
        phoneNumber: phone,

        status: "connecting",

        sock: null,

        generation:
            generation,

        activeGeneration:
            generation,

        handlersLoadedFor:
            null,

        reconnectTimer:
            null,

        notify:
            typeof notify ===
            "function"
                ? notify
                : null,

        registered:
            false,

        pairingInProgress:
            false,

        badSessionTries:
            existing &&
            existing.badSessionTries
                ? existing.badSessionTries
                : 0
    };

    userSessions.set(
        phone,
        session
    );

    let state;
    let saveCreds;

    try {
        const authState =
            await useMultiFileAuthState(
                authDir
            );

        state =
            authState.state;

        saveCreds =
            authState.saveCreds;
    } catch (err) {
        if (
            userSessions.get(
                phone
            ) === session
        ) {
            userSessions.delete(
                phone
            );
        }

        throw err;
    }

    session.registered =
        Boolean(
            state.creds &&
            state.creds.registered
        );

    /*
     * Get latest Baileys version.
     */
    let version;

    try {
        const latest =
            await fetchLatestBaileysVersion();

        version =
            latest &&
            latest.version
                ? latest.version
                : [
                      2,
                      3000,
                      1015901307
                  ];
    } catch (e) {
        version = [
            2,
            3000,
            1015901307
        ];
    }

    /*
     * Browser identity.
     */
    let browser;

    try {
        browser =
            Browsers.ubuntu(
                "Chrome"
            );
    } catch (e) {
        browser = [
            "Ubuntu",
            "Chrome",
            "22.04.4"
        ];
    }

    /*
     * Create socket.
     */
    let sock;

    try {
        sock =
            makeWASocket({
                version:
                    version,

                logger:
                    logger,

                auth: {
                    creds:
                        state.creds,

                    keys:
                        makeCacheableSignalKeyStore(
                            state.keys,
                            logger
                        )
                },

                browser:
                    browser,

                printQRInTerminal:
                    false,

                syncFullHistory:
                    false,

                fireInitQueries:
                    false,

                markOnlineOnConnect:
                    false,

                generateHighQualityLinkPreview:
                    false,

                connectTimeoutMs:
                    60000,

                keepAliveIntervalMs:
                    30000,

                retryRequestDelayMs:
                    500
            });
    } catch (err) {
        if (
            userSessions.get(
                phone
            ) === session
        ) {
            userSessions.delete(
                phone
            );
        }

        throw err;
    }

    session.sock =
        sock;

    /*
     * Credentials.
     */
    sock.ev.on(
        "creds.update",
        async function () {
            if (
                !isCurrentSession(
                    session,
                    sock
                )
            ) {
                return;
            }

            try {
                await saveCreds();

                session.registered =
                    Boolean(
                        state.creds &&
                        state.creds
                            .registered
                    );
            } catch (e) {
                console.log(
                    "[" +
                        uid +
                        "/" +
                        phone +
                        "] saveCreds error:",
                    e &&
                    e.message
                        ? e.message
                        : e
                );
            }
        }
    );

    /*
     * Connection state.
     */
    sock.ev.on(
        "connection.update",
        async function (
            update
        ) {
            if (
                !isCurrentSession(
                    session,
                    sock
                )
            ) {
                return;
            }

            const connection =
                update.connection;

            const lastDisconnect =
                update.lastDisconnect;

            /*
             * ----------------------------------------------------
             * CONNECTED
             * ----------------------------------------------------
             */
            if (
                connection ===
                "open"
            ) {
                if (
                    !isCurrentSession(
                        session,
                        sock
                    )
                ) {
                    return;
                }

                session.status =
                    "connected";

                session.registered =
                    true;

                session.pairingInProgress =
                    false;

                session.badSessionTries =
                    0;

                /*
                 * Load handlers ONLY here.
                 */
                await loadHandlers(
                    sock,
                    session
                );

                if (
                    !isCurrentSession(
                        session,
                        sock
                    )
                ) {
                    return;
                }

                if (
                    session.notify
                ) {
                    try {
                        await session.notify(
                            "VENOM X CONNECTED\n\n" +
                                "Number: +" +
                                phone +
                                "\n" +
                                "Session: ACTIVE"
                        );
                    } catch (e) {}
                }

                console.log(
                    "[" +
                        uid +
                        "/" +
                        phone +
                        "] WhatsApp connected"
                );

                return;
            }

            /*
             * ----------------------------------------------------
             * CLOSED
             * ----------------------------------------------------
             */
            if (
                connection ===
                "close"
            ) {
                /*
                 * Make sure this callback still
                 * belongs to the current socket.
                 */
                if (
                    session.sock !==
                    sock
                ) {
                    return;
                }

                let statusCode =
                    0;

                try {
                    const error =
                        lastDisconnect &&
                        lastDisconnect.error;

                    statusCode =
                        (
                            error &&
                            error.output &&
                            error.output
                                .statusCode
                        ) ||
                        (
                            error &&
                            error.statusCode
                        ) ||
                        0;
                } catch (e) {}

                console.log(
                    "[" +
                        uid +
                        "/" +
                        phone +
                        "] connection closed:",
                    statusCode
                );

                /*
                 * Invalidate this socket immediately.
                 */
                session.sock =
                    null;

                session.handlersLoadedFor =
                    null;

                session.pairingInProgress =
                    false;

                session.status =
                    "disconnected";

                /*
                 * Determine whether WhatsApp
                 * credentials were successfully
                 * registered.
                 */
                const nowRegistered =
                    Boolean(
                        state.creds &&
                        state.creds.registered
                    );

                session.registered =
                    nowRegistered;

                /*
                 * ------------------------------------------------
                 * LOGGED OUT
                 * ------------------------------------------------
                 */
                if (
                    statusCode ===
                        DisconnectReason.loggedOut ||
                    statusCode ===
                        401
                ) {
                    removeAuth(
                        uid,
                        phone
                    );

                    if (
                        userSessions.get(
                            phone
                        ) === session
                    ) {
                        userSessions.delete(
                            phone
                        );
                    }

                    if (
                        session.notify
                    ) {
                        try {
                            await session.notify(
                                "WHATSAPP LOGGED OUT\n\n" +
                                    "Number: +" +
                                    phone +
                                    "\n\n" +
                                    "Use /pair again."
                            );
                        } catch (e) {}
                    }

                    return;
                }

                /*
                 * ------------------------------------------------
                 * PAIRING NOT FINISHED
                 * ------------------------------------------------
                 */
                if (
                    !nowRegistered
                ) {
                    /*
                     * During pairing, don't leave a
                     * dead session sitting around.
                     */
                    if (
                        userSessions.get(
                            phone
                        ) === session
                    ) {
                        userSessions.delete(
                            phone
                        );
                    }

                    /*
                     * Retry a few temporary pairing
                     * channel failures.
                     */
                    if (
                        (
                            statusCode ===
                                428 ||
                            statusCode ===
                                408 ||
                            statusCode ===
                                515
                        ) &&
                        retryCount < 2
                    ) {
                        console.log(
                            "[" +
                                uid +
                                "/" +
                                phone +
                                "] pairing retry " +
                                (
                                    retryCount +
                                    1
                                )
                        );

                        if (
                            session.notify
                        ) {
                            try {
                                await session.notify(
                                    "Pairing channel closed (" +
                                        statusCode +
                                        "). Retrying " +
                                        (
                                            retryCount +
                                            1
                                        ) +
                                        "/2..."
                                );
                            } catch (e) {}
                        }

                        await sleep(
                            2000
                        );

                        try {
                            await createSocket(
                                uid,
                                phone,
                                notify,
                                retryCount +
                                    1
                            );

                            return;
                        } catch (e) {
                            console.log(
                                "[" +
                                    uid +
                                    "/" +
                                    phone +
                                    "] pairing retry failed:",
                                e &&
                                e.message
                                    ? e.message
                                    : e
                            );
                        }
                    }

                    if (
                        session.notify
                    ) {
                        try {
                            await session.notify(
                                "PAIRING SESSION CLOSED\n\n" +
                                    "Number: +" +
                                    phone +
                                    "\n" +
                                    "Status: " +
                                    statusCode +
                                    "\n\n" +
                                    "Try /pair again."
                            );
                        } catch (e) {}
                    }

                    return;
                }

                /*
                 * ------------------------------------------------
                 * BAD SESSION
                 * ------------------------------------------------
                 */
                if (
                    statusCode ===
                        DisconnectReason.badSession ||
                    statusCode ===
                        500
                ) {
                    session.badSessionTries =
                        (
                            session.badSessionTries ||
                            0
                        ) + 1;

                    if (
                        session.badSessionTries <=
                        1
                    ) {
                        console.log(
                            "[" +
                                uid +
                                "/" +
                                phone +
                                "] bad session — soft reconnect"
                        );

                        /*
                         * Keep auth for the first
                         * reconnect attempt.
                         */
                        scheduleReconnect(
                            session,
                            uid,
                            phone,
                            session.notify,
                            3000
                        );

                        return;
                    }

                    console.log(
                        "[" +
                            uid +
                            "/" +
                            phone +
                            "] bad session — wiping auth"
                    );

                    removeAuth(
                        uid,
                        phone
                    );

                    if (
                        userSessions.get(
                            phone
                        ) === session
                    ) {
                        userSessions.delete(
                            phone
                        );
                    }

                    if (
                        session.notify
                    ) {
                        try {
                            await session.notify(
                                "BAD SESSION\n\n" +
                                    "Number: +" +
                                    phone +
                                    "\n\n" +
                                    "Use /pair again."
                            );
                        } catch (e) {}
                    }

                    return;
                }

                /*
                 * ------------------------------------------------
                 * NORMAL RECONNECTABLE CLOSE
                 * ------------------------------------------------
                 */
                if (
                    statusCode ===
                        DisconnectReason.connectionLost ||
                    statusCode ===
                        DisconnectReason.timedOut ||
                    statusCode ===
                        DisconnectReason.connectionClosed ||
                    statusCode ===
                        DisconnectReason.restartRequired ||
                    statusCode ===
                        DisconnectReason.unavailableService ||
                    statusCode ===
                        408 ||
                    statusCode ===
                        428 ||
                    statusCode ===
                        440 ||
                    statusCode ===
                        515
                ) {
                    /*
                     * Keep the session object so the
                     * reconnect timer owns it.
                     */
                    if (
                        userSessions.get(
                            phone
                        ) !== session
                    ) {
                        return;
                    }

                    console.log(
                        "[" +
                            uid +
                            "/" +
                            phone +
                            "] scheduling reconnect..."
                    );

                    scheduleReconnect(
                        session,
                        uid,
                        phone,
                        session.notify,
                        statusCode ===
                            DisconnectReason.restartRequired ||
                        statusCode ===
                            515
                            ? 2500
                            : 4000
                    );

                    return;
                }

                /*
                 * ------------------------------------------------
                 * UNKNOWN CLOSE
                 * ------------------------------------------------
                 *
                 * Don't blindly wipe the session.
                 * Keep auth and retry after a delay.
                 */
                console.log(
                    "[" +
                        uid +
                        "/" +
                        phone +
                        "] unknown close " +
                        statusCode +
                        " — reconnecting"
                );

                if (
                    userSessions.get(
                        phone
                    ) === session
                ) {
                    scheduleReconnect(
                        session,
                        uid,
                        phone,
                        session.notify,
                        6000
                    );
                }
            }
        }
    );

    /*
     * ------------------------------------------------------------
     * PAIRING
     * ------------------------------------------------------------
     *
     * Pairing code is requested while the socket
     * is connecting, NOT after connection === open.
     */
    if (
        !state.creds.registered
    ) {
        session.pairingInProgress =
            true;

        /*
         * Give the socket a short moment to
         * initialize, but do NOT wait 8 seconds.
         */
        await sleep(1200);

        if (
            !isCurrentSession(
                session,
                sock
            )
        ) {
            return session;
        }

        try {
            console.log(
                "[" +
                    uid +
                    "/" +
                    phone +
                    "] requesting pairing code"
            );

            const code =
                await requestPairingCode(
                    sock,
                    session
                );

            if (
                !isCurrentSession(
                    session,
                    sock
                )
            ) {
                throw new Error(
                    "Socket closed before pairing completed"
                );
            }

            if (
                session.notify
            ) {
                try {
                    await session.notify(
                        "VENOM X PAIRING CODE\n\n" +
                            "Number: +" +
                            phone +
                            "\n" +
                            "Code: " +
                            code +
                            "\n\n" +
                            "OPEN WHATSAPP NOW\n" +
                            "Linked Devices -> Link with phone number\n" +
                            "ENTER CODE IMMEDIATELY"
                    );
                } catch (e) {}
            }

            console.log(
                "[" +
                    uid +
                    "/" +
                    phone +
                    "] pairing code: " +
                    code
            );
        } catch (err) {
            /*
             * If the account became registered
             * during the request, don't destroy
             * the successful session.
             */
            if (
                state.creds &&
                state.creds.registered
            ) {
                session.registered =
                    true;

                session.pairingInProgress =
                    false;

                return session;
            }

            session.pairingInProgress =
                false;

            session.status =
                "error";

            await killSessionObject(
                session,
                "pairing failed"
            );

            if (
                userSessions.get(
                    phone
                ) === session
            ) {
                userSessions.delete(
                    phone
                );
            }

            /*
             * Only remove auth when pairing
             * never successfully registered.
             */
            if (
                !(
                    state.creds &&
                    state.creds.registered
                )
            ) {
                removeAuth(
                    uid,
                    phone
                );
            }

            if (
                session.notify
            ) {
                try {
                    await session.notify(
                        "PAIRING FAILED\n\n" +
                            "Number: +" +
                            phone +
                            "\n\n" +
                            (
                                err &&
                                err.message
                                    ? err.message
                                    : String(
                                          err
                                      )
                            )
                    );
                } catch (e) {}
            }

            throw err;
        }
    } else {
        console.log(
            "[" +
                uid +
                "/" +
                phone +
                "] using saved session"
        );
    }

    return session;
}

/*
|--------------------------------------------------------------------------
| DISCONNECT ONE NUMBER
|--------------------------------------------------------------------------
*/

async function disconnectUserPhone(
    userId,
    phoneNumber,
    options
) {
    options =
        options || {};

    const wipeAuth =
        options.wipeAuth === true;

    const uid =
        sanitizeUserId(
            userId
        );

    const phone =
        sanitizePhone(
            phoneNumber
        );

    const userSessions =
        getUserSessions(uid);

    const session =
        userSessions.get(
            phone
        );

    const saved =
        authExists(
            uid,
            phone
        );

    if (session) {
        await killSessionObject(
            session,
            "user disconnect"
        );

        if (
            userSessions.get(
                phone
            ) === session
        ) {
            userSessions.delete(
                phone
            );
        }
    }

    let removed = false;

    if (wipeAuth) {
        removed =
            removeAuth(
                uid,
                phone
            );
    }

    return {
        active:
            Boolean(session),

        saved:
            saved,

        removed:
            Boolean(session) ||
            removed
    };
}

/*
|--------------------------------------------------------------------------
| DISCONNECT ALL
|--------------------------------------------------------------------------
*/

async function disconnectUser(
    userId,
    options
) {
    options =
        options || {};

    const wipeAuth =
        options.wipeAuth === true;

    const uid =
        sanitizeUserId(
            userId
        );

    const active =
        getAllSessions(uid);

    for (
        let i = 0;
        i < active.length;
        i++
    ) {
        await disconnectUserPhone(
            uid,
            active[i]
                .phoneNumber,
            {
                wipeAuth:
                    wipeAuth
            }
        );
    }

    if (wipeAuth) {
        try {
            const root =
                userRoot(uid);

            if (
                fs.existsSync(
                    root
                )
            ) {
                fs.rmSync(
                    root,
                    {
                        recursive:
                            true,
                        force:
                            true
                    }
                );
            }
        } catch (e) {}
    }

    return (
        active.length >
        0
    );
}

/*
|--------------------------------------------------------------------------
| UNPAIR
|--------------------------------------------------------------------------
*/

async function unpairUserPhone(
    userId,
    phoneNumber
) {
    return disconnectUserPhone(
        userId,
        phoneNumber,
        {
            wipeAuth:
                true
        }
    );
}

/*
|--------------------------------------------------------------------------
| STATUS
|--------------------------------------------------------------------------
*/

function getStatus(
    userId
) {
    const uid =
        sanitizeUserId(
            userId
        );

    const list =
        getAllSessions(
            uid
        );

    return {
        connected:
            list.some(
                function (s) {
                    return (
                        s.status ===
                        "connected"
                    );
                }
            ),

        status:
            list.length
                ? "ACTIVE"
                : "INACTIVE",

        sessions:
            list.map(
                function (s) {
                    return {
                        phoneNumber:
                            s.phoneNumber,

                        status:
                            s.status,

                        connected:
                            s.status ===
                            "connected",

                        saved:
                            authExists(
                                uid,
                                s.phoneNumber
                            )
                    };
                }
            )
    };
}

/*
|--------------------------------------------------------------------------
| SAVED SESSIONS
|--------------------------------------------------------------------------
*/

function listSavedSessions(
    userId
) {
    const uid =
        sanitizeUserId(
            userId
        );

    const root =
        userRoot(uid);

    if (
        !fs.existsSync(
            root
        )
    ) {
        return [];
    }

    try {
        return fs
            .readdirSync(
                root,
                {
                    withFileTypes:
                        true
                }
            )
            .filter(
                function (entry) {
                    return entry.isDirectory();
                }
            )
            .map(
                function (entry) {
                    return entry.name;
                }
            )
            .filter(
                function (phone) {
                    try {
                        sanitizePhone(
                            phone
                        );

                        return true;
                    } catch (e) {
                        return false;
                    }
                }
            );
    } catch (e) {
        return [];
    }
}

/*
|--------------------------------------------------------------------------
| ALL ACTIVE SESSION OBJECTS
|--------------------------------------------------------------------------
*/

function listActiveSessions() {
    const result =
        [];

    sessions.forEach(
        function (
            userMap,
            uid
        ) {
            userMap.forEach(
                function (
                    session,
                    phone
                ) {
                    result.push({
                        telegramUserId:
                            uid,

                        phoneNumber:
                            phone,

                        status:
                            session.status,

                        connected:
                            session.status ===
                            "connected",

                        saved:
                            authExists(
                                uid,
                                phone
                            )
                    });
                }
            );
        }
    );

    return result;
}

/*
|--------------------------------------------------------------------------
| SESSION PATH
|--------------------------------------------------------------------------
*/

function sessionPath(
    userId,
    phone
) {
    return phonePath(
        userId,
        phone
    );
}

/*
|--------------------------------------------------------------------------
| EXPORTS
|--------------------------------------------------------------------------
*/

module.exports = {
    createSocket:
        createSocket,

    disconnectUser:
        disconnectUser,

    disconnectUserPhone:
        disconnectUserPhone,

    unpairUserPhone:
        unpairUserPhone,

    getStatus:
        getStatus,

    getSession:
        getSession,

    getAllSessions:
        getAllSessions,

    listActiveSessions:
        listActiveSessions,

    listSavedSessions:
        listSavedSessions,

    authExists:
        authExists,

    removeAuth:
        removeAuth,

    sanitizeUserId:
        sanitizeUserId,

    sanitizePhone:
        sanitizePhone,

    sessionPath:
        sessionPath
};
