function normalizePhone(input) {
    const phone = String(input || "").replace(/\D/g, "");

    if (!phone || phone.length < 8 || phone.length > 15) {
        return null;
    }

    return phone;
}

function isValidPhone(input) {
    return Boolean(normalizePhone(input));
}

module.exports = {
    normalizePhone,
    isValidPhone
};
