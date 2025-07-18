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

// Konfigurasi Player (FINAL WORKING VERSION!)
console.log("🎵 Discord Music Bot - FINAL FIXED VERSION");

const player = new Player(client, {
    ytdlOptions: {
        quality: 'highestaudio',
        highWaterMark: 1 << 25
    }
});

// Function untuk membersihkan URL YouTube
function cleanYouTubeURL(url) {
    try {
        if (!url.includes('youtube.com') && !url.includes('youtu.be')) {
            return url;
        }
        
        let cleanUrl = url;
        cleanUrl = cleanUrl.split('&')[0];
        cleanUrl = cleanUrl.split('?si=')[0];
        cleanUrl = cleanUrl.split('?t=')[0];
        
        console.log(`🧹 URL cleaned: ${url} → ${cleanUrl}`);
        return cleanUrl;
    } catch (error) {
        console.log(`⚠️ Error cleaning URL, using original: ${url}`);
        return url;
    }
}

// Function untuk detect apakah query adalah URL atau text
function isURL(query) {
    return query.includes('youtube.com') || 
           query.includes('youtu.be') || 
           query.includes('spotify.com') ||
           query.includes('soundcloud.com') ||
           query.startsWith('http');
}

// Load extractors
let extractorsLoaded = false;

async function loadExtractors() {
    try {
        const { YoutubeiExtractor } = await import('discord-player-youtubei');
        await player.extractors.register(YoutubeiExtractor, {});
        console.log("✅ YouTube Extractor loaded!");
        
        const { DefaultExtractors } = await import('@discord-player/extractor');
        await player.extractors.loadMulti(DefaultExtractors);
        console.log("✅ Default Extractors loaded!");
        
        const loadedExtractors = player.extractors.store.size;
        console.log(`📊 Total extractors loaded: ${loadedExtractors}`);
        
        extractorsLoaded = true;
        
    } catch (error) {
        console.error("❌ Error loading extractors:", error.message);
        extractorsLoaded = false;
    }
}

await loadExtractors();

// Event handlers (FIXED!)
player.events.on("playerStart", (queue, track) => {
    console.log(`🎶 Now playing: ${track.title} - ${track.author}`);
    if (queue.metadata && queue.metadata.channel) {
        queue.metadata.channel.send(`🎶 Sekarang memutar: **${track.title}** oleh **${track.author}**`);
    }
});

player.events.on("emptyQueue", (queue) => {
    console.log("📭 Queue empty, leaving voice channel");
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

// FIXED: Debug event handler
player.events.on("debug", (message) => {
    // Safely convert to string and filter noisy warnings
    try {
        const msgStr = typeof message === 'string' ? message : String(message);
        if (!msgStr.includes('[YOUTUBEJS]') && !msgStr.includes('InnertubeError') && !msgStr.includes('GridShelfView')) {
            console.log(`[Player Debug] ${msgStr}`);
        }
    } catch (e) {
        // Ignore debug message errors
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
- !help ➔ Menampilkan command list

🎵 **Contoh:**
- !play https://youtu.be/fDrTbLXHKu8
- !play never gonna give you up
- !play jangan menyerah`);
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

  // Play YouTube Audio (FINAL WORKING VERSION!)
  if (message.content.startsWith("!play ")) {
    const voiceChannel = message.member?.voice.channel;
    if (!voiceChannel) {
        return message.reply("❌ Kamu harus join voice channel dulu.");
    }

    let query = message.content.slice("!play ".length).trim();
    if (!query) {
        return message.reply('Tolong berikan nama lagu atau link YouTube!');
    }

    // Clean URL jika YouTube
    const originalQuery = query;
    query = cleanYouTubeURL(query);
    
    console.log(`🔍 Searching: ${query}`);
    
    if (!extractorsLoaded) {
        return message.reply("❌ Extractors belum selesai loading. Tunggu sebentar dan coba lagi.");
    }
    
    try {
        const extractorCount = player.extractors.store.size;
        console.log(`📊 Available extractors: ${extractorCount}`);
        
        if (extractorCount === 0) {
            return message.reply("❌ Tidak ada extractor yang ter-load! Restart bot dan pastikan dependencies terinstall.");
        }

        // Search dengan multiple search engines
        let searchResult = null;
        let attempts = 0;
        const maxAttempts = 3;
        
        // Determine search engines to try based on query type
        const searchEngines = isURL(query) ? ["youtube", "auto"] : ["youtube"];
        
        while (!searchResult && attempts < maxAttempts) {
            attempts++;
            console.log(`🔍 Attempt ${attempts}/${maxAttempts} for: ${query}`);
            
            for (const engine of searchEngines) {
                try {
                    console.log(`  📡 Trying search engine: ${engine}`);
                    
                    searchResult = await player.search(query, {
                        requestedBy: message.author,
                        searchEngine: engine
                    });
                    
                    if (searchResult && searchResult.tracks.length > 0) {
                        console.log(`  ✅ Success with ${engine}!`);
                        break;
                    } else {
                        console.log(`  ❌ No results with ${engine}`);
                    }
                    
                } catch (searchError) {
                    console.error(`  ❌ Search error with ${engine}:`, searchError.message);
                }
            }
            
            // If still no results, try different variations
            if (!searchResult && attempts < maxAttempts) {
                if (attempts === 1 && isURL(query)) {
                    // Try without parameters
                    query = query.split('?')[0];
                    console.log(`🧹 Trying without parameters: ${query}`);
                } else if (attempts === 2 && !isURL(originalQuery)) {
                    // For text queries, try adding "official" or "lyrics"
                    query = originalQuery + " official";
                    console.log(`🎵 Trying with "official": ${query}`);
                }
                
                // Wait before retry
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        if (!searchResult || !searchResult.tracks.length) {
            console.log(`❌ No results after ${maxAttempts} attempts for: ${originalQuery}`);
            return message.reply(`❌ Tidak ditemukan hasil untuk: **${originalQuery}**

💡 **Tips:**
- Untuk URL: Pastikan link YouTube valid
- Untuk text: Coba dengan kata kunci yang lebih spesifik
- Contoh: \`!play never gonna give you up rick astley\``);
        }

        console.log(`✅ Found ${searchResult.tracks.length} track(s) on attempt ${attempts}`);
        console.log(`🎵 Playing: ${searchResult.tracks[0].title} - ${searchResult.tracks[0].author}`);

        // Play the track
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
        console.error(`❌ Error playing song:`, e);
        await message.reply(`❌ Maaf, tidak bisa memutar lagu itu: ${e.message}

💡 **Coba:**
- Gunakan URL YouTube yang berbeda
- Gunakan nama lagu yang lebih spesifik
- Pastikan FFmpeg terinstall dengan benar`);
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

  // Stop (FIXED!)
  if (message.content.startsWith("!stop")) {
    const queue = player.queues.get(message.guild.id);
    if (!queue || !queue.isPlaying()) {
      return message.reply("❌ Tidak ada lagu yang sedang diputar.");
    }
    
    try {
        // FIXED: Use delete() instead of destroy() for discord-player v7
        queue.delete();
        return message.reply("⏹️ Playback dihentikan dan bot keluar dari voice channel.");
    } catch (error) {
        console.error("❌ Error stopping queue:", error);
        // Fallback: try to disconnect manually
        try {
            const connection = queue.connection;
            if (connection) {
                connection.destroy();
            }
            return message.reply("⏹️ Playback dihentikan.");
        } catch (fallbackError) {
            console.error("❌ Fallback error:", fallbackError);
            return message.reply("❌ Terjadi kesalahan saat menghentikan playback.");
        }
    }
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