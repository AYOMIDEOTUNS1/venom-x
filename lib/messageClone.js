"use strict";

function clonedMessageHasField(object, wantedField, depth, visited) {
    depth = depth || 0;
    visited = visited || new Set();
    if (
        !object ||
        typeof object !== "object" ||
        depth > 20 ||
        Buffer.isBuffer(object) ||
        visited.has(object)
    ) {
        return false;
    }
    visited.add(object);
    if (object[wantedField] != null) return true;
    const values = Object.values(object);
    for (let i = 0; i < values.length; i++) {
        if (clonedMessageHasField(values[i], wantedField, depth + 1, visited)) {
            return true;
        }
    }
    return false;
}

function collectClonedMessageTypes(object, output, depth, visited) {
    output = output || new Set();
    depth = depth || 0;
    visited = visited || new Set();
    if (
        !object ||
        typeof object !== "object" ||
        depth > 20 ||
        Buffer.isBuffer(object) ||
        visited.has(object)
    ) {
        return output;
    }
    visited.add(object);
    const entries = Object.entries(object);
    for (let i = 0; i < entries.length; i++) {
        const key = entries[i][0];
        const value = entries[i][1];
        if (
            value != null &&
            typeof value === "object" &&
            (key.endsWith("Message") ||
                key === "interactiveMessage" ||
                key === "carouselMessage")
        ) {
            output.add(key);
        }
        collectClonedMessageTypes(value, output, depth + 1, visited);
    }
    return output;
}

function getCloneRelayNodes(message, jid) {
    const nodes = [];
    const hasButtons = clonedMessageHasField(message, "buttonsMessage");
    const hasInteractive = clonedMessageHasField(message, "interactiveMessage");
    const hasCarousel = clonedMessageHasField(message, "carouselMessage");
    const hasList = clonedMessageHasField(message, "listMessage");

    if (hasButtons || hasInteractive || hasCarousel) {
        nodes.push({
            tag: "biz",
            attrs: {},
            content: [
                {
                    tag: "interactive",
                    attrs: { type: "native_flow", v: "1" },
                    content: [
                        {
                            tag: "native_flow",
                            attrs: { v: "9", name: "mixed" },
                            content: undefined
                        }
                    ]
                }
            ]
        });
    }

    if (hasList) {
        nodes.push({
            tag: "biz",
            attrs: {},
            content: [
                {
                    tag: "list",
                    attrs: { v: "2", type: "product_list" },
                    content: undefined
                }
            ]
        });
    }

    if (nodes.length > 0 && jid && !String(jid).endsWith("@g.us")) {
        nodes.push({
            tag: "bot",
            attrs: { biz_bot: "1" },
            content: undefined
        });
    }

    return nodes;
}

function ensureCache() {
    if (!global.completeMessageCache) {
        global.completeMessageCache = new Map();
    }
    return global.completeMessageCache;
}

function cacheRawMessage(jid, id, message, proto) {
    try {
        if (!jid || !id || !message || !proto) return;
        const cache = ensureCache();
        let rawBytes;
        try {
            rawBytes = Buffer.from(proto.Message.encode(message).finish());
        } catch (e) {
            rawBytes = Buffer.from(
                proto.Message.encode(proto.Message.fromObject(message)).finish()
            );
        }
        cache.set(String(jid) + ":" + String(id), rawBytes);
        while (cache.size > 1000) {
            const oldest = cache.keys().next().value;
            cache.delete(oldest);
        }
    } catch (e) {
        console.log("[MSG CACHE]", e.message);
    }
}

module.exports = {
    clonedMessageHasField,
    collectClonedMessageTypes,
    getCloneRelayNodes,
    ensureCache,
    cacheRawMessage
};
