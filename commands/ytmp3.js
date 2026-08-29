const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const yt = require("../lib/youtube");

module.exports = {
    name: "ytmp3",
    aliases: [
        "mp3",
        "song",
        "music"
    ],

    run: async ({ sock, from, args, reply, message }) => {

    if (!args.length)
      return reply("❌ Usage:\n.ytmp3 <YouTube link or search>");

    try {

      let input = args.join(" ");

      let data;

      if (input.startsWith("http"))
        data = await yt.info(input);
      else
        data = await yt.search(input);

      const title = yt.sanitize(data.title);
      const output = path.join(yt.TMP, `${title}.mp3`);

      await sock.sendMessage(from, {
    react: {
        text: "⏳",
        key: message.key
    }
});

await reply(
`╭━━〔 🎧 VENOM X 〕━━⬣
┃
┃ 🔎 Searching...
┃ ⬇️ Downloading Audio...
┃
╰━━━━━━━━━━━━━━━━⬣`
);

      const proc = spawn("yt-dlp", [
        "-x",
        "--audio-format",
        "mp3",
        "--audio-quality",
        "0",
        "-o",
        output.replace(".mp3", ".%(ext)s"),
        data.webpage_url
      ]);

      proc.on("close", async (code) => {

        if (code !== 0)
          return reply("❌ Download failed.");

        await sock.sendMessage(
          from,
          {
            audio: fs.readFileSync(output),
            mimetype: "audio/mpeg",
            ptt: false
          },
          {
            quoted: message
          }
        );

        await reply(
`╭━━〔 🎧 VENOM X MUSIC 〕━━⬣
┃ 🎵 Title : ${data.title}
┃
┃ 👤 Channel : ${data.uploader}
┃
┃ ⏱ Duration : ${data.duration_string}
┃
┃ ✅ Audio Ready
╰━━━━━━━━━━━━━━━━⬣`
);

await sock.sendMessage(from,{
    react:{
        text:"🎵",
        key:message.key
    }
});

await sock.sendMessage(from,{
    react:{
        text:"✅",
        key:message.key
    }
});

        fs.unlinkSync(output);

      });

    } catch (err) {
      console.log(err);
      await sock.sendMessage(from,{
    react:{
        text:"❌",
        key:message.key
    }
});

reply(
`╭━━〔 ❌ VENOM X ERROR 〕━━⬣
┃ Failed to download audio.
┃
┃ Check the link or try again.
╰━━━━━━━━━━━━━━━━⬣`
);
    }

  }
};
