let lastSend = 0;
const MIN_DELAY = 1200; // 1.2 seconds minimum between sends

async function safeSend(sock, jid, content, options = {}) {
    const now = Date.now();
    const wait = MIN_DELAY - (now - lastSend);
    if (wait > 0) {
        await new Promise(r => setTimeout(r, wait));
    }
    lastSend = Date.now();
    return sock.sendMessage(jid, content, options);
}

module.exports = { safeSend };
