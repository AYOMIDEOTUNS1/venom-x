module.exports = {
    name: "game",
    aliases: ["games"],

    run: async ({ reply, args }) => {

        const game = (args[0] || "").toLowerCase();
        const choice = (args[1] || "").toLowerCase();

        // =========================
        // 🎮 GAME MENU
        // =========================

        if (!game) {
            return reply(
`╭━━〔 🎮 VENOM X GAMES 〕━━⬣
┃
┃ 🎲 .game dice
┃ 🪙 .game coin
┃ ✊ .game rps rock
┃ ✊ .game rps paper
┃ ✊ .game rps scissors
┃ 🔢 .game guess 5
┃ 🧠 .game quiz B
┃ 🌍 .game trivia B
┃
┃ ⚡ Have fun!
╰━━━━━━━━━━━━━━━━⬣`
            );
        }

        // =========================
        // 🎲 DICE
        // =========================

        if (game === "dice") {

            const roll =
                Math.floor(Math.random() * 6) + 1;

            return reply(
`╭━━〔 🎲 VENOM DICE 〕━━⬣
┃
┃ 🎲 You rolled : ${roll}
┃
┃ 🤖 VENOM X
╰━━━━━━━━━━━━━━━━⬣`
            );
        }

        // =========================
        // 🪙 COIN
        // =========================

        if (game === "coin") {

            const result =
                Math.random() < 0.5
                    ? "HEADS 🪙"
                    : "TAILS 🪙";

            return reply(
`╭━━〔 🪙 COIN FLIP 〕━━⬣
┃
┃ 🪙 Result : ${result}
┃
╰━━━━━━━━━━━━━━━━⬣`
            );
        }

        // =========================
        // ✊ ROCK PAPER SCISSORS
        // =========================

        if (game === "rps") {

            const choices = [
                "rock",
                "paper",
                "scissors"
            ];

            if (!choices.includes(choice)) {
                return reply(
`╭━━〔 ✊ RPS 〕━━⬣
┃
┃ Choose:
┃
┃ 🪨 .game rps rock
┃ 📄 .game rps paper
┃ ✂️ .game rps scissors
┃
╰━━━━━━━━━━━━━━━━⬣`
                );
            }

            const botChoice =
                choices[
                    Math.floor(
                        Math.random() * choices.length
                    )
                ];

            let result;

            if (choice === botChoice) {
                result = "🤝 DRAW!";
            } else if (
                (choice === "rock" &&
                    botChoice === "scissors") ||
                (choice === "paper" &&
                    botChoice === "rock") ||
                (choice === "scissors" &&
                    botChoice === "paper")
            ) {
                result = "🏆 YOU WIN!";
            } else {
                result = "🤖 VENOM X WINS!";
            }

            const icons = {
                rock: "🪨",
                paper: "📄",
                scissors: "✂️"
            };

            return reply(
`╭━━〔 ✊ ROCK PAPER SCISSORS 〕━━⬣
┃
┃ 👤 You : ${icons[choice]} ${choice}
┃ 🤖 VENOM : ${icons[botChoice]} ${botChoice}
┃
┃ ${result}
┃
╰━━━━━━━━━━━━━━━━⬣`
            );
        }

        // =========================
        // 🔢 GUESS
        // =========================

        if (game === "guess") {

            const number =
                Number(choice);

            if (
                !Number.isInteger(number) ||
                number < 1 ||
                number > 10
            ) {
                return reply(
`╭━━〔 🔢 GUESSING GAME 〕━━⬣
┃
┃ Guess a number from 1–10.
┃
┃ Example:
┃ .game guess 7
┃
╰━━━━━━━━━━━━━━━━⬣`
                );
            }

            const secret =
                Math.floor(Math.random() * 10) + 1;

            if (number === secret) {
                return reply(
`╭━━〔 🎯 GUESSING GAME 〕━━⬣
┃
┃ 🎉 Correct!
┃ 🎯 Number : ${secret}
┃
┃ 🏆 You got it!
╰━━━━━━━━━━━━━━━━⬣`
                );
            }

            return reply(
`╭━━〔 🔢 GUESSING GAME 〕━━⬣
┃
┃ ❌ Wrong!
┃
┃ 👤 Your guess : ${number}
┃ 🤖 Number was : ${secret}
┃
┃ 🔄 Try again!
╰━━━━━━━━━━━━━━━━⬣`
            );
        }

        // =========================
        // 🧠 QUIZ
        // =========================

        if (game === "quiz") {

            if (!choice) {
                return reply(
`╭━━〔 🧠 VENOM QUIZ 〕━━⬣
┃
┃ ❓ What is the capital of Nigeria?
┃
┃ A️⃣ Lagos
┃ B️⃣ Abuja
┃ C️⃣ Kano
┃ D️⃣ Ibadan
┃
┃ Answer:
┃ .game quiz B
┃
╰━━━━━━━━━━━━━━━━⬣`
                );
            }

            if (choice === "b") {
                return reply(
`╭━━〔 🧠 VENOM QUIZ 〕━━⬣
┃
┃ ✅ Correct!
┃
┃ 🇳🇬 Abuja is the capital
┃    of Nigeria.
┃
┃ 🏆 +1 Point
╰━━━━━━━━━━━━━━━━⬣`
                );
            }

            return reply(
`╭━━〔 🧠 VENOM QUIZ 〕━━⬣
┃
┃ ❌ Wrong!
┃
┃ ✅ Correct answer: B️⃣ Abuja
┃
╰━━━━━━━━━━━━━━━━⬣`
            );
        }

        // =========================
        // 🌍 TRIVIA
        // =========================

        if (game === "trivia") {

            if (!choice) {
                return reply(
`╭━━〔 🌍 VENOM TRIVIA 〕━━⬣
┃
┃ ❓ Which planet is known
┃    as the Red Planet?
┃
┃ A️⃣ Earth
┃ B️⃣ Mars
┃ C️⃣ Jupiter
┃ D️⃣ Venus
┃
┃ Answer:
┃ .game trivia B
┃
╰━━━━━━━━━━━━━━━━⬣`
                );
            }

            if (choice === "b") {
                return reply(
`╭━━〔 🌍 VENOM TRIVIA 〕━━⬣
┃
┃ ✅ Correct!
┃
┃ 🔴 Mars is known as
┃    the Red Planet.
┃
┃ 🏆 +1 Point
╰━━━━━━━━━━━━━━━━⬣`
                );
            }

            return reply(
`╭━━〔 🌍 VENOM TRIVIA 〕━━⬣
┃
┃ ❌ Wrong!
┃
┃ ✅ Correct answer: B️⃣ Mars
┃
╰━━━━━━━━━━━━━━━━⬣`
            );
        }

        // =========================
        // ❌ UNKNOWN GAME
        // =========================

        return reply(
`╭━━〔 ❌ UNKNOWN GAME 〕━━⬣
┃
┃ Use .game to see
┃ all available games.
┃
╰━━━━━━━━━━━━━━━━⬣`
        );
    }
};
