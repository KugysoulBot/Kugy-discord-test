import { Client, GatewayIntentBits, Partials } from "discord.js";
import { Player } from "discord-player";
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

// Konfigurasi Player (Local Extractor Only - WORKING!)
console.log("🎵 Menggunakan Local Extractor dengan YouTube Support");

const player = new Player(client, {
    ytdlOptions: {
        quality: 'highestaudio',
        highWaterMark: 1 << 25
    }
});

// Load YouTube extractor dan default extractors
console.log("📦 Memuat YouTube Extractor...");

try {
    // Load YouTube extractor (WAJIB untuk YouTube!)
    const { YoutubeiExtractor } = await import('discord-player-youtubei');
    await player.extractors.register(YoutubeiExtractor, {});
    console.log("✅ YouTube Extractor berhasil dimuat!");
    
    // Load default extractors untuk platform lain
    const { DefaultExtractors } = await import('@discord-player/extractor');
    await player.extractors.loadMulti(DefaultExtractors);
    console.log("✅ Default Extractors berhasil dimuat!");
    
    // Verifikasi extractor yang ter-load
    const loadedExtractors = player.extractors.store.size;
    console.log(`📊 Total extractor ter-load: ${loadedExtractors}`);
    
    // List semua extractor
    console.log("📝 Extractor yang tersedia:");
    for (const [name, extractor] of player.extractors.store) {
        console.log(`  - ${extractor.constructor.name}`);
    }
    
} catch (error) {
    console.error("❌ Error loading extractors:", error.message);
    console.error("💡 Install dependencies:");
    console.error("   npm install discord-player-youtubei @discord-player/extractor");
}

// Event handlers
player.events.on("playerStart", (queue, track) => {
    console.log(`🎶 Mulai memutar: ${track.title} - ${track.author}`);
    if (queue.metadata && queue.metadata.channel) {
        queue.metadata.channel.send(`🎶 Sekarang memutar: **${track.title}** oleh **${track.author}**`);
    }
});

player.events.on("emptyQueue", (queue) => {
    console.log("📭 Antrian kosong, keluar dari voice channel");
    if (queue.metadata && queue.metadata.channel) {
        queue.metadata.channel.send("✅ Antrian kosong. Keluar dari channel suara.");
    }
});

player.events.on("error", (queue, error) => {
    console.error(`❌ Player error:`, error);
    if (queue.metadata && queue.metadata.channel) {
        queue.metadata.channel.send(`❌ Terjadi kesalahan: ${error.message}`);
    }
});

player.events.on("playerError", (queue, error) => {
    console.error(`❌ Player error event:`, error);
});

player.events.on("debug", (message) => {
    // Filter out noisy YouTube.js warnings
    if (!message.includes('[YOUTUBEJS]') && !message.includes('InnertubeError')) {
        console.log(`[Player Debug] ${message}`);
    }
});

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
- !play <url_youtube_atau_nama_lagu> ➔ Play audio dari YouTube
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

  // Play YouTube Audio (WORKING VERSION!)
  if (message.content.startsWith("!play ")) {
    const voiceChannel = message.member?.voice.channel;
    if (!voiceChannel) {
        return message.reply("❌ Kamu harus join voice channel dulu.");
    }

    const query = message.content.slice("!play ".length).trim();
    if (!query) {
        return message.reply('Tolong berikan nama lagu atau link YouTube!');
    }

    console.log(`🔍 Mencari: ${query}`);
    
    try {
        // Cek jumlah extractor sebelum play
        const extractorCount = player.extractors.store.size;
        console.log(`📊 Extractor tersedia: ${extractorCount}`);
        
        if (extractorCount === 0) {
            return message.reply("❌ Tidak ada extractor yang ter-load! Restart bot dan pastikan dependencies terinstall.");
        }

        // Clean URL dari parameter yang tidak perlu
        let cleanQuery = query;
        if (query.includes('?si=') || query.includes('&si=')) {
            cleanQuery = query.split('?si=')[0].split('&si=')[0];
            console.log(`🧹 Cleaned URL: ${cleanQuery}`);
        }

        // Search terlebih dahulu - gunakan "auto" untuk kompatibilitas terbaik
        const searchResult = await player.search(cleanQuery, {
            requestedBy: message.author,
            searchEngine: "auto"
        });

        if (!searchResult || !searchResult.tracks.length) {
            console.log(`❌ Tidak ada hasil untuk: ${query}`);
            return message.reply(`❌ Tidak ditemukan hasil untuk: ${query}`);
        }

        console.log(`✅ Ditemukan ${searchResult.tracks.length} track(s)`);
        console.log(`🎵 Playing: ${searchResult.tracks[0].title} - ${searchResult.tracks[0].author}`);

        // Play menggunakan search result
        const { track } = await player.play(voiceChannel, searchResult, {
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
        } else if (queue && queue.tracks.size > 0 && queue.currentTrack !== track) {
            await message.reply(`✅ Ditambahkan ke antrian: **${track.title}**`);
        }
    } catch (e) {
        console.error(`❌ Error saat mencoba memutar lagu:`, e);
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