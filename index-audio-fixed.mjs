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

// Konfigurasi Player dengan Audio Fixes
console.log("🎵 Discord Music Bot - AUDIO FIXED VERSION");

const player = new Player(client, {
    ytdlOptions: {
        quality: 'highestaudio',
        highWaterMark: 1 << 25,
        filter: 'audioonly',
        begin: 0  // FIXED: Mulai dari detik 0
    },
    // FIXED: Audio configuration untuk stability
    audioPlayerOptions: {
        behaviors: {
            noSubscriber: 'pause',
            maxMissedFrames: Math.round(5000 / 20), // 5 seconds
        }
    },
    // FIXED: Connection options
    connectionOptions: {
        selfDeaf: true,
        selfMute: false,
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

// FIXED: Enhanced Event Handlers untuk Audio Stability
player.events.on("playerStart", (queue, track) => {
    console.log(`🎶 Now playing: ${track.title} - ${track.author}`);
    console.log(`⏱️ Duration: ${track.duration}`);
    console.log(`🔊 Starting from: 0:00`);
    
    if (queue.metadata && queue.metadata.channel) {
        queue.metadata.channel.send(`🎶 Sekarang memutar: **${track.title}** oleh **${track.author}**\n⏱️ Durasi: ${track.duration}`);
    }
});

// FIXED: Better queue management untuk mencegah bot keluar
player.events.on("playerFinish", (queue, track) => {
    console.log(`✅ Finished playing: ${track.title}`);
    console.log(`📊 Queue size after finish: ${queue.tracks.size}`);
    
    // FIXED: Jangan langsung disconnect jika masih ada lagu
    if (queue.tracks.size > 0) {
        console.log(`🔄 Playing next track...`);
    } else {
        console.log(`📭 No more tracks, will leave in 30 seconds if no new songs added`);
    }
});

player.events.on("emptyQueue", (queue) => {
    console.log("📭 Queue empty, leaving voice channel in 30 seconds");
    if (queue.metadata && queue.metadata.channel) {
        queue.metadata.channel.send("✅ Antrian kosong. Bot akan keluar dari channel dalam 30 detik jika tidak ada lagu baru.");
    }
    
    // FIXED: Delay sebelum keluar untuk memberi waktu user add lagu baru
    setTimeout(() => {
        const currentQueue = player.queues.get(queue.metadata.guild.id);
        if (currentQueue && currentQueue.tracks.size === 0 && !currentQueue.isPlaying()) {
            console.log("🚪 Leaving voice channel due to empty queue");
            try {
                currentQueue.delete();
            } catch (error) {
                console.error("❌ Error leaving voice channel:", error);
            }
        }
    }, 30000); // 30 detik delay
});

// FIXED: Enhanced error handling
player.events.on("error", (queue, error) => {
    console.error(`❌ Player error:`, error);
    if (queue.metadata && queue.metadata.channel) {
        queue.metadata.channel.send(`❌ Terjadi kesalahan: ${error.message}`);
    }
});

player.events.on("playerError", (queue, error) => {
    console.error(`❌ Player error event:`, error);
    
    // FIXED: Auto-retry jika error saat playing
    if (queue.tracks.size > 0) {
        console.log("🔄 Attempting to play next track after error...");
        setTimeout(() => {
            try {
                queue.skip();
            } catch (skipError) {
                console.error("❌ Error skipping after player error:", skipError);
            }
        }, 2000);
    }
});

// FIXED: Connection state monitoring
player.events.on("connectionCreate", (queue) => {
    console.log(`🔗 Voice connection created for guild: ${queue.metadata.guild.name}`);
});

player.events.on("connectionDestroyed", (queue) => {
    console.log(`🔌 Voice connection destroyed for guild: ${queue.metadata.guild.name}`);
});

// FIXED: Debug event handler
player.events.on("debug", (message) => {
    try {
        const msgStr = typeof message === 'string' ? message : String(message);
        if (!msgStr.includes('[YOUTUBEJS]') && 
            !msgStr.includes('InnertubeError') && 
            !msgStr.includes('GridShelfView') &&
            !msgStr.includes('Received voice state update')) {
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
- !play jangan menyerah

🔧 **Audio Features:**
- ✅ Mulai dari detik 0
- ✅ Auto-play lagu berikutnya
- ✅ 30 detik delay sebelum keluar channel`);
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

  // FIXED: Enhanced Play Command dengan Audio Fixes
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

        // FIXED: Enhanced play options untuk audio stability
        const { track } = await player.play(voiceChannel, searchResult, {
            nodeOptions: {
                metadata: {
                    channel: message.channel,
                    textChannelId: message.channel.id,
                    guild: message.guild,
                },
                // FIXED: Audio options untuk mulai dari detik 0
                selfDeafen: true,
                volume: 100,
                leaveOnEnd: false,        // FIXED: Jangan langsung keluar
                leaveOnStop: false,       // FIXED: Jangan keluar saat stop manual
                leaveOnEmpty: false,      // FIXED: Jangan keluar saat queue kosong (handled by event)
                leaveOnEmptyCooldown: 30000, // 30 detik delay
            },
        });

        const queue = player.queues.get(message.guild.id);
        
        // FIXED: Better feedback messages
        if (track.playlist) {
            await message.reply(`✅ Playlist ditambahkan: **${track.playlist.title}** (${track.playlist.tracks.length} lagu)
🎵 Mulai memutar dari detik 0`);
        } else if (queue && queue.tracks.size > 0 && queue.currentTrack !== track) {
            await message.reply(`✅ Ditambahkan ke antrian: **${track.title}**
📊 Posisi dalam antrian: ${queue.tracks.size}`);
        } else {
            await message.reply(`🎵 Mulai memutar: **${track.title}**
⏱️ Durasi: ${track.duration}
🔊 Mulai dari detik 0`);
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
    
    const currentTrack = queue.currentTrack;
    queue.skip();
    
    return message.reply(`⏭️ Lagu di-skip: **${currentTrack?.title || 'Unknown'}**
📊 Lagu tersisa dalam antrian: ${queue.tracks.size}`);
  }

  // FIXED: Enhanced Stop Command
  if (message.content.startsWith("!stop")) {
    const queue = player.queues.get(message.guild.id);
    if (!queue || !queue.isPlaying()) {
      return message.reply("❌ Tidak ada lagu yang sedang diputar.");
    }
    
    try {
        const currentTrack = queue.currentTrack;
        queue.delete();
        return message.reply(`⏹️ Playback dihentikan: **${currentTrack?.title || 'Unknown'}**
🚪 Bot keluar dari voice channel.`);
    } catch (error) {
        console.error("❌ Error stopping queue:", error);
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

  // FIXED: Enhanced Queue Command
  if (message.content.startsWith("!queue")) {
    const queue = player.queues.get(message.guild.id);
    if (!queue || (!queue.currentTrack && queue.tracks.size === 0)) {
        return message.reply("❌ Antrian kosong.");
    }

    const currentTrack = queue.currentTrack;
    let queueString = '';
    
    if (currentTrack) {
        queueString += `🎶 **Sekarang diputar:**\n${currentTrack.title} - ${currentTrack.author}\n⏱️ Durasi: ${currentTrack.duration}\n\n`;
    }

    if (queue.tracks.size > 0) {
        queueString += `**Antrian Selanjutnya (${queue.tracks.size} lagu):**\n`;
        queueString += queue.tracks.map((track, i) => `${i + 1}. ${track.title} - ${track.author} (${track.duration})`).slice(0, 10).join('\n');
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