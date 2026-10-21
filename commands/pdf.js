"use strict";

/**
 * Minimal text PDF (no extra npm deps)
 * #pdf Your text here
 * reply to text + #pdf
 */

function escapePdfText(s) {
    return String(s || "")
        .replace(/\\/g, "\\\\")
        .replace(/\(/g, "\\(")
        .replace(/\)/g, "\\)");
}

function wrapLines(text, maxChars) {
    const words = String(text || "").split(/\s+/);
    const lines = [];
    let line = "";
    for (let i = 0; i < words.length; i++) {
        const w = words[i];
        if ((line + " " + w).trim().length > maxChars) {
            if (line) lines.push(line);
            line = w;
        } else {
            line = (line + " " + w).trim();
        }
    }
    if (line) lines.push(line);
    return lines.slice(0, 80);
}

function buildPdf(title, body) {
    const lines = [];
    lines.push(String(title || "VENOM X PDF").slice(0, 80));
    lines.push("");
    const bodyLines = String(body || "").split(/\r?\n/);
    for (let i = 0; i < bodyLines.length; i++) {
        const wrapped = wrapLines(bodyLines[i], 90);
        for (let j = 0; j < wrapped.length; j++) lines.push(wrapped[j]);
    }
    if (!lines.length) lines.push("(empty)");

    // Simple single-page-ish content stream (multi-line)
    let y = 800;
    const contentParts = ["BT", "/F1 11 Tf", "50 " + y + " Td"];
    for (let i = 0; i < lines.length; i++) {
        const t = escapePdfText(lines[i]);
        if (i === 0) {
            contentParts.push("(" + t + ") Tj");
        } else {
            contentParts.push("0 -14 Td (" + t + ") Tj");
        }
        y -= 14;
        if (y < 50) break;
    }
    contentParts.push("ET");
    const stream = contentParts.join("\n");

    const objects = [];
    objects.push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
    objects.push(
        "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n"
    );
    objects.push(
        "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n"
    );
    objects.push(
        "4 0 obj\n<< /Length " +
            Buffer.byteLength(stream, "utf8") +
            " >>\nstream\n" +
            stream +
            "\nendstream\nendobj\n"
    );
    objects.push(
        "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n"
    );

    let pdf = "%PDF-1.4\n";
    const offsets = [0];
    for (let i = 0; i < objects.length; i++) {
        offsets.push(Buffer.byteLength(pdf, "utf8"));
        pdf += objects[i];
    }
    const xrefPos = Buffer.byteLength(pdf, "utf8");
    pdf += "xref\n0 " + (objects.length + 1) + "\n";
    pdf += "0000000000 65535 f \n";
    for (let i = 1; i < offsets.length; i++) {
        pdf += String(offsets[i]).padStart(10, "0") + " 00000 n \n";
    }
    pdf +=
        "trailer\n<< /Size " +
        (objects.length + 1) +
        " /Root 1 0 R >>\nstartxref\n" +
        xrefPos +
        "\n%%EOF";

    return Buffer.from(pdf, "utf8");
}

function getQuotedText(message) {
    const q =
        message?.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    if (!q) return "";
    return (
        q.conversation ||
        q.extendedTextMessage?.text ||
        q.imageMessage?.caption ||
        q.videoMessage?.caption ||
        q.documentMessage?.caption ||
        ""
    ).trim();
}

module.exports = {
    name: "pdf",
    aliases: ["topdf", "makepdf"],

    run: async function ({ sock, from, args, message, reply }) {
        let text = (args || []).join(" ").trim();
        if (!text) text = getQuotedText(message);

        if (!text) {
            return reply(
`╭━━〔 📄 VENOM PDF 〕━━⬣
┃
┃ Create a PDF from text
┃
┃ #pdf Your notes here
┃ Reply to a message + #pdf
┃
╰━━━━━━━━━━━━━━━━⬣`
            );
        }

        try {
            const buf = buildPdf("VENOM X", text);
            await sock.sendMessage(
                from,
                {
                    document: buf,
                    mimetype: "application/pdf",
                    fileName: "VENOM-X.pdf",
                    caption: "✅ PDF ready\n⚡ VENOM X"
                },
                { quoted: message }
            );
        } catch (err) {
            return reply("❌ PDF failed: " + (err.message || err));
        }
    }
};
