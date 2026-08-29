const fs = require("fs");

const file = "./data/imageHistory.json";

function load() {
    if (!fs.existsSync(file)) {
        fs.writeFileSync(file, "{}");
    }

    return JSON.parse(
        fs.readFileSync(file)
    );
}

function save(data) {
    fs.writeFileSync(
        file,
        JSON.stringify(data, null, 2)
    );
}

module.exports = {

    add(user, image) {

        const data = load();

        if (!data[user]) {
            data[user] = [];
        }

        data[user].unshift(image);

        // keep only last 10
        data[user] = data[user].slice(0, 10);

        save(data);
    },


    get(user) {

        const data = load();

        return data[user] || [];
    }

};
