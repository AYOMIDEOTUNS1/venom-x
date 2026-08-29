const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const yt = require("../lib/youtube");

module.exports = {
    name: "ytmp4",
    aliases: [
        "video",
        "vid",
        "mp4"
    ],

    run: async ({ sock, from, args, reply, message }) => {

        if (!args.length)
            return reply(
`╭━━〔 🎬 VENOM X VIDEO 〕━━⬣
┃
┃ Usage:
┃ .ytmp4 <link or search>
┃
┃ Example:
┃ .video Faded
╰━━━━━━━━━━━━━━━━⬣`
);

        try {

            let input = args.join(" ");

            let data;

            if (input.startsWith("http"))
                data = await yt.info(input);
            else
                data = await yt.search(input);

            const title = yt.sanitize(data.title);

            const output = path.join(
                yt.TMP,
                `${title}.mp4`
            );

            await sock.sendMessage(from,{
                react:{
                    text:"⏳",
                    key:message.key
                }
            });

            await reply(
`╭━━〔 🎬 VENOM X 〕━━⬣
┃
┃ 🔎 Searching...
┃ ⬇️ Downloading Video...
┃
╰━━━━━━━━━━━━━━━━⬣`
);

            const proc = spawn("yt-dlp",[
                "-f",
                "best[ext=mp4]",
                "-o",
                output,
                data.webpage_url
            ]);

            proc.on("close",async(code)=>{

                if(code!==0)
                    return reply("❌ Download failed.");

                await sock.sendMessage(
                    from,
                    {
                        video:fs.readFileSync(output),
                        caption:
`╭━━〔 🎬 VENOM X VIDEO 〕━━⬣
┃ 🎥 ${data.title}
┃
┃ 👤 ${data.uploader}
┃
┃ ⏱ ${data.duration_string}
┃
┃ ✅ Download Complete
╰━━━━━━━━━━━━━━━━⬣`
                    },
                    {
                        quoted:message
                    }
                );

                await sock.sendMessage(from,{
                    react:{
                        text:"🎬",
                        key:message.key
                    }
                });

                await sock.sendMessage(from,{
                    react:{
                        text:"✅",
                        key:message.key
                    }
                });

                if(fs.existsSync(output))
                    fs.unlinkSync(output);

            });

        } catch(err){

            console.log(err);

            try{
                await sock.sendMessage(from,{
                    react:{
                        text:"❌",
                        key:message.key
                    }
                });
            }catch{}

            reply(
`╭━━〔 ❌ VENOM X ERROR 〕━━⬣
┃ Failed to download video.
┃
┃ Check the link or try again.
╰━━━━━━━━━━━━━━━━⬣`
);

        }

    }
};
