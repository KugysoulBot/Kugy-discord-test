import { Client, GatewayIntentBits, Partials } from "discord.js";
import { Player } from "discord-player";
import { DefaultExtractors } from '@discord-player/extractor';
import mongoose from "mongoose";
import "dotenv/config";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.Channel],
});

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch(err => console.error("❌ MongoDB connection error:", err));

const userSchema = new mongoose.Schema({
  userId: String,
  xp: Number,
  level: Number,
});

const User = mongoose.model("User", userSchema);

const player = new Player(client, {
    nodes: [
        {
            name: 'default',
            url: `${process.env.LAVALINK_HOST}:${process.env.LAVALINK_PORT}`,
            password: process.env.LAVALINK_PASSWORD,
            secure: false,
        },
    ],
    autoSkip: true,
    leaveOnEnd: true,
    leaveOnStop: true,
    leaveOnEmpty: true,
    maxQueueSize: 1000,
});

player.extractors.loadMulti(DefaultExtractors);

player.events.on("playerStart", (queue, track) => {
    if (queue.metadata && queue.metadata.channel) {
        queue.metadata.channel.send(`🎶 Sekarang memutar: **${track.title}** oleh **${track.author}**`);
    } else {
        const channel = client.channels.cache.get(queue.textChannel);
        if (channel) channel.send(`🎶 Sekarang memutar: **${track.title}** oleh **${track.author}**`);
    }
});

player.events.on("emptyQueue", (queue) => {
    if (queue.metadata && queue.metadata.channel) {
        queue.metadata.channel.send("✅ Antrian kosong. Keluar dari channel suara.");
    } else {
        const channel = client.channels.cache.get(queue.textChannel);
        if (channel) channel.send("✅ Antrian kosong. Keluar dari channel suara.");
    }
});

player.events.on("error", (queue, error) => {
    console.error(`❌ Error dari discord-player di guild ${queue.guild.name}:`, error);
    if (queue.metadata && queue.metadata.channel) {
        queue.metadata.channel.send(`❌ Terjadi kesalahan saat memutar: ${error.message}`);
    }
});

player.events.on("playerError", (queue, error) => {
    console.error(`❌ Player error event dari guild ${queue.guild.name}:`, error);
    if (queue.metadata && queue.metadata.channel) {
        queue.metadata.channel.send(`❌ Terjadi kesalahan pada player: ${error.message}`);
    }
});

player.events.on("nodesManagerError", (node, error) => console.error(`❌ Lavalink node "${node.name}" error: ${error.message}`));
player.events.on("debug", (message) => console.log(`[Player Debug] ${message}`));
player.events.on("nodeConnect", (node) => console.log(`✅ Lavalink node "${node.name}" connected.`));
player.events.on("nodeDisconnect", (node) => console.warn(`⚠️ Lavalink node "${node.name}" disconnected.`));
player.events.on("nodeError", (node, error) => console.error(`❌ Lavalink node "${node.name}" experienced an error: ${error.message}`));

client.once("ready", () => {
  console.log(`✅ Bot aktif sebagai ${client.user.tag}`);
});

client.on("guildMemberAdd", async (member) => {
  const channel = member.guild.systemChannel;
  if (channel) {
    channel.send(`👋 Selamat datang, ${member.user.username}!`);
  }
  await User.findOneAndUpdate(
    { userId: member.id },
    { $setOnInsert: { xp: 0, level: 1 } },
    { upsert: true, new: true }
  );
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  // Leveling system
  let user = await User.findOne({ userId: message.author.id });
  if (!user) {
    user = await User.create({ userId: message.author.id, xp: 0, level: 1 });
  }
  user.xp += 10;
  if (user.xp >= user.level * 100) {
    user.level += 1;
    user.xp = 0;
    message.reply(`🎉 Selamat ${message.author.username}, kamu naik ke level ${user.level}!`);
  }
  await user.save();

  // HELP COMMAND
  if (message.content === "!help") {
    return message.reply(`📜 **Daftar Command:**
- !chat <pesan> ➔ Chat dengan AI
- !play <url_youtube> ➔ Play audio dari YouTube (Lavalink)
- !skip ➔ Skip lagu
- !stop ➔ Stop lagu
- !queue ➔ Tampilkan antrian lagu
- !help ➔ Menampilkan command list`);
  }

  // AI Chat
  if (message.mentions.has(client.user.id) || message.content.startsWith("!chat ")) {
    const prompt = message.content
      .replace(/<@!?(\d+)>/, "")
      .replace("!chat ", "")
      .trim();

    try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        },
        body: JSON.stringify({
            model: "meta-llama/llama-3.1-8b-instruct",
            messages: [
                {
                    role: "system",
                    content: "You are Kugy AI, a cute, supportive, and humble Indonesian assistant. Always reply warmly and motivatively.",
                },
            { role: "user", content: prompt },
            ],
        }),
      });

      const data = await response.json();
      const aiReply = data.choices[0].message.content;
      await message.reply({ content: `<@${message.author.id}> ${aiReply}` });
    } catch (error) {
      console.error(error);
      await message.reply("❌ Gagal menghubungi AI agent.");
    }
  }

  // Play YouTube Audio (Lavalink)
  if (message.content.startsWith("!play ")) {
    const voiceChannel = message.member?.voice.channel;
    if (!voiceChannel) {
        return message.reply("❌ Kamu harus join voice channel dulu.");
    }

    const query = message.content.slice("!play ".length).trim();
    if (!query) {
        return message.reply('Tolong berikan nama lagu atau link YouTube!');
    }

    try {
        const { track } = await player.play(voiceChannel, query, {
            nodeOptions: {
                metadata: {
                    channel: message.channel,
                    textChannelId: message.channel.id,
                },
                selfDeafen: true,
            },
        });

        const queue = player.queues.get(message.guild.id);
        if (track.playlist) {
            await message.reply(`✅ Playlist ditambahkan: **${track.playlist.title}** (${track.playlist.tracks.length} lagu)`);
        } else if (queue.tracks.size > 0 && queue.currentTrack !== track) {
            await message.reply(`✅ Ditambahkan ke antrian: **${track.title}**`);
        }
    } catch (e) {
        console.error(`Error saat mencoba memutar lagu: ${e.message}`);
        await message.reply(`❌ Maaf, tidak bisa memutar lagu itu: ${e.message}`);
    }
  }

  // Skip
  if (message.content.startsWith("!skip")) {
    const queue = player.queues.get(message.guild.id);
    if (!queue || !queue.isPlaying()) {
        return message.reply("❌ Tidak ada lagu yang sedang diputar atau di antrian.");
    }
    queue.skip();
    return message.reply("⏭️ Lagu di-skip.");
  }

  // Stop
  if (message.content.startsWith("!stop")) {
    const queue = player.queues.get(message.guild.id);
    if (!queue || !queue.isPlaying()) {
      return message.reply("❌ Tidak ada lagu yang sedang diputar.");
    }
    queue.destroy();
    return message.reply("⏹️ Playback dihentikan dan bot keluar dari voice channel.");
  }

  // Queue
  if (message.content.startsWith("!queue")) {
    const queue = player.queues.get(message.guild.id);
    if (!queue || queue.tracks.size === 0) {
        return message.reply("❌ Antrian kosong.");
    }

    const currentTrack = queue.currentTrack;
    let queueString = currentTrack ? `🎶 **Sekarang diputar:** ${currentTrack.title} - ${currentTrack.author}\n\n` : '';

    if (queue.tracks.size > 0) {
        queueString += `**Antrian Selanjutnya:**\n`;
        queueString += queue.tracks.map((track, i) => `${i + 1}. ${track.title} - ${track.author}`).slice(0, 10).join('\n');
        if (queue.tracks.size > 10) {
            queueString += `\n...dan ${queue.tracks.size - 10} lagu lainnya.`;
        }
    } else if (!currentTrack) {
        return message.reply("❌ Antrian kosong.");
    }

    return message.reply(queueString);
  }
});

client.login(process.env.DISCORD_TOKEN);
