import { Client, GatewayIntentBits, Partials, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from "discord.js";
import { Player } from "discord-player";
import mongoose from "mongoose";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from 'url';
import "dotenv/config";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

// Express App untuk Dashboard
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'dashboard')));

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch(err => console.error("❌ MongoDB connection error:", err));

const userSchema = new mongoose.Schema({
  userId: String,
  xp: Number,
  level: Number,
});

const User = mongoose.model("User", userSchema);

// Global state untuk dashboard
let globalState = {
  isPlaying: false,
  currentTrack: null,
  queue: [],
  loopMode: 'off', // 'off', 'track', 'queue'
  volume: 100,
  guildId: null,
  voiceChannelId: null
};

// Konfigurasi Player dengan Loop Support
console.log("🎵 Discord Music Bot - WITH DASHBOARD & LOOP");

const player = new Player(client, {
    ytdlOptions: {
        quality: 'highestaudio',
        highWaterMark: 1 << 25,
        filter: 'audioonly',
        begin: 0
    },
    audioPlayerOptions: {
        behaviors: {
            noSubscriber: 'pause',
            maxMissedFrames: Math.round(5000 / 20),
        }
    },
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

// Function untuk update global state
function updateGlobalState(queue) {
    if (queue) {
        globalState.isPlaying = queue.isPlaying();
        globalState.currentTrack = queue.currentTrack ? {
            title: queue.currentTrack.title,
            author: queue.currentTrack.author,
            duration: queue.currentTrack.duration,
            url: queue.currentTrack.url
        } : null;
        globalState.queue = queue.tracks.map(track => ({
            title: track.title,
            author: track.author,
            duration: track.duration
        }));
        globalState.guildId = queue.metadata?.guild?.id;
        globalState.voiceChannelId = queue.connection?.joinConfig?.channelId;
    }
}

// Function untuk create control buttons
function createControlButtons() {
    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('music_play_pause')
                .setLabel(globalState.isPlaying ? '⏸️ Pause' : '▶️ Play')
                .setStyle(globalState.isPlaying ? ButtonStyle.Secondary : ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('music_skip')
                .setLabel('⏭️ Skip')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('music_stop')
                .setLabel('⏹️ Stop')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId('music_loop')
                .setLabel(`🔄 Loop: ${globalState.loopMode.toUpperCase()}`)
                .setStyle(globalState.loopMode === 'off' ? ButtonStyle.Secondary : ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('music_queue')
                .setLabel('📋 Queue')
                .setStyle(ButtonStyle.Secondary)
        );
    return row;
}

// Enhanced Event Handlers dengan Loop Support
player.events.on("playerStart", (queue, track) => {
    console.log(`🎶 Now playing: ${track.title} - ${track.author}`);
    console.log(`🔄 Loop mode: ${globalState.loopMode}`);
    
    updateGlobalState(queue);
    
    if (queue.metadata && queue.metadata.channel) {
        const embed = new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle('🎶 Now Playing')
            .setDescription(`**${track.title}**\nby ${track.author}`)
            .addFields(
                { name: '⏱️ Duration', value: track.duration, inline: true },
                { name: '🔄 Loop Mode', value: globalState.loopMode.toUpperCase(), inline: true }
            )
            .setThumbnail(track.thumbnail);
            
        const row = createControlButtons();
        
        queue.metadata.channel.send({ 
            embeds: [embed], 
            components: [row] 
        });
    }
});

// LOOP FUNCTIONALITY - Enhanced playerFinish event
player.events.on("playerFinish", (queue, track) => {
    console.log(`✅ Finished playing: ${track.title}`);
    console.log(`🔄 Loop mode: ${globalState.loopMode}`);
    
    updateGlobalState(queue);
    
    // LOOP LOGIC
    if (globalState.loopMode === 'track') {
        // Loop current track
        console.log(`🔄 Looping track: ${track.title}`);
        setTimeout(() => {
            queue.insertTrack(track, 0); // Insert at beginning
        }, 1000);
    } else if (globalState.loopMode === 'queue' && queue.tracks.size === 0) {
        // Loop entire queue - add current track to end
        console.log(`🔄 Looping queue, adding ${track.title} to end`);
        setTimeout(() => {
            queue.addTrack(track);
        }, 1000);
    }
    
    if (queue.tracks.size > 0) {
        console.log(`🔄 Playing next track...`);
    } else if (globalState.loopMode === 'off') {
        console.log(`📭 No more tracks, will leave in 30 seconds if no new songs added`);
    }
});

player.events.on("emptyQueue", (queue) => {
    console.log("📭 Queue empty");
    updateGlobalState(queue);
    
    if (globalState.loopMode === 'off') {
        console.log("🚪 Leaving voice channel in 30 seconds");
        if (queue.metadata && queue.metadata.channel) {
            queue.metadata.channel.send("✅ Antrian kosong. Bot akan keluar dari channel dalam 30 detik jika tidak ada lagu baru.");
        }
        
        setTimeout(() => {
            const currentQueue = player.queues.get(queue.metadata.guild.id);
            if (currentQueue && currentQueue.tracks.size === 0 && !currentQueue.isPlaying()) {
                console.log("🚪 Leaving voice channel due to empty queue");
                try {
                    currentQueue.delete();
                    globalState.isPlaying = false;
                    globalState.currentTrack = null;
                } catch (error) {
                    console.error("❌ Error leaving voice channel:", error);
                }
            }
        }, 30000);
    }
});

player.events.on("error", (queue, error) => {
    console.error(`❌ Player error:`, error);
    updateGlobalState(queue);
});

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
  console.log(`🌐 Dashboard akan tersedia di: http://localhost:3000`);
});

// Button Interaction Handler
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;
    
    const queue = player.queues.get(interaction.guild.id);
    
    try {
        switch (interaction.customId) {
            case 'music_play_pause':
                if (!queue || !queue.isPlaying()) {
                    await interaction.reply({ content: '❌ Tidak ada lagu yang sedang diputar.', ephemeral: true });
                    return;
                }
                
                if (queue.node.isPaused()) {
                    queue.node.resume();
                    await interaction.reply({ content: '▶️ Musik dilanjutkan!', ephemeral: true });
                } else {
                    queue.node.pause();
                    await interaction.reply({ content: '⏸️ Musik dijeda!', ephemeral: true });
                }
                updateGlobalState(queue);
                break;
                
            case 'music_skip':
                if (!queue || !queue.isPlaying()) {
                    await interaction.reply({ content: '❌ Tidak ada lagu yang sedang diputar.', ephemeral: true });
                    return;
                }
                
                const currentTrack = queue.currentTrack;
                queue.skip();
                await interaction.reply({ content: `⏭️ Lagu di-skip: **${currentTrack?.title || 'Unknown'}**`, ephemeral: true });
                updateGlobalState(queue);
                break;
                
            case 'music_stop':
                if (!queue || !queue.isPlaying()) {
                    await interaction.reply({ content: '❌ Tidak ada lagu yang sedang diputar.', ephemeral: true });
                    return;
                }
                
                queue.delete();
                globalState.loopMode = 'off'; // Reset loop when stopping
                await interaction.reply({ content: '⏹️ Musik dihentikan dan bot keluar dari voice channel.', ephemeral: true });
                updateGlobalState(null);
                break;
                
            case 'music_loop':
                // Cycle through loop modes: off -> track -> queue -> off
                if (globalState.loopMode === 'off') {
                    globalState.loopMode = 'track';
                } else if (globalState.loopMode === 'track') {
                    globalState.loopMode = 'queue';
                } else {
                    globalState.loopMode = 'off';
                }
                
                await interaction.reply({ 
                    content: `🔄 Loop mode diubah ke: **${globalState.loopMode.toUpperCase()}**\n` +
                            `${globalState.loopMode === 'track' ? '🎵 Akan mengulang lagu saat ini' : 
                              globalState.loopMode === 'queue' ? '📋 Akan mengulang seluruh antrian' : 
                              '⏹️ Loop dimatikan'}`, 
                    ephemeral: true 
                });
                
                // Update buttons
                if (queue && queue.metadata && queue.metadata.channel) {
                    const newRow = createControlButtons();
                    // Note: You might want to edit the original message with new buttons
                }
                break;
                
            case 'music_queue':
                if (!queue || (!queue.currentTrack && queue.tracks.size === 0)) {
                    await interaction.reply({ content: '❌ Antrian kosong.', ephemeral: true });
                    return;
                }
                
                const embed = new EmbedBuilder()
                    .setColor('#0099FF')
                    .setTitle('📋 Music Queue')
                    .addFields({ name: '🔄 Loop Mode', value: globalState.loopMode.toUpperCase(), inline: true });
                
                if (queue.currentTrack) {
                    embed.addFields({ 
                        name: '🎶 Currently Playing', 
                        value: `${queue.currentTrack.title} - ${queue.currentTrack.author}`, 
                        inline: false 
                    });
                }
                
                if (queue.tracks.size > 0) {
                    const queueList = queue.tracks.map((track, i) => 
                        `${i + 1}. ${track.title} - ${track.author}`
                    ).slice(0, 10).join('\n');
                    
                    embed.addFields({ 
                        name: `📋 Up Next (${queue.tracks.size} songs)`, 
                        value: queueList + (queue.tracks.size > 10 ? `\n...and ${queue.tracks.size - 10} more` : ''), 
                        inline: false 
                    });
                }
                
                await interaction.reply({ embeds: [embed], ephemeral: true });
                break;
        }
    } catch (error) {
        console.error('❌ Button interaction error:', error);
        await interaction.reply({ content: '❌ Terjadi kesalahan saat memproses perintah.', ephemeral: true });
    }
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
    const embed = new EmbedBuilder()
        .setColor('#0099FF')
        .setTitle('📜 Command List')
        .setDescription('Daftar command yang tersedia:')
        .addFields(
            { name: '🎵 Music Commands', value: '`!play <url/nama_lagu>` - Play musik\n`!skip` - Skip lagu\n`!stop` - Stop musik\n`!queue` - Lihat antrian\n`!loop <off/track/queue>` - Set loop mode', inline: false },
            { name: '🤖 Other Commands', value: '`!chat <pesan>` - Chat dengan AI\n`!help` - Tampilkan help', inline: false },
            { name: '🎛️ Dashboard Features', value: '• Control buttons untuk play/pause/skip/stop\n• Loop mode: OFF/TRACK/QUEUE\n• Real-time queue display\n• Web dashboard di http://localhost:3000', inline: false }
        );
    
    return message.reply({ embeds: [embed] });
  }

  // Loop command
  if (message.content.startsWith("!loop ")) {
    const mode = message.content.slice("!loop ".length).trim().toLowerCase();
    
    if (!['off', 'track', 'queue'].includes(mode)) {
        return message.reply('❌ Mode loop tidak valid. Gunakan: `off`, `track`, atau `queue`');
    }
    
    globalState.loopMode = mode;
    
    const modeDescriptions = {
        'off': '⏹️ Loop dimatikan',
        'track': '🎵 Akan mengulang lagu saat ini',
        'queue': '📋 Akan mengulang seluruh antrian'
    };
    
    return message.reply(`🔄 Loop mode diubah ke: **${mode.toUpperCase()}**\n${modeDescriptions[mode]}`);
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

  // Enhanced Play Command dengan Dashboard Integration
  if (message.content.startsWith("!play ")) {
    const voiceChannel = message.member?.voice.channel;
    if (!voiceChannel) {
        return message.reply("❌ Kamu harus join voice channel dulu.");
    }

    let query = message.content.slice("!play ".length).trim();
    if (!query) {
        return message.reply('Tolong berikan nama lagu atau link YouTube!');
    }

    const originalQuery = query;
    query = cleanYouTubeURL(query);
    
    console.log(`🔍 Searching: ${query}`);
    
    if (!extractorsLoaded) {
        return message.reply("❌ Extractors belum selesai loading. Tunggu sebentar dan coba lagi.");
    }
    
    try {
        let searchResult = null;
        let attempts = 0;
        const maxAttempts = 3;
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
                    }
                } catch (searchError) {
                    console.error(`  ❌ Search error with ${engine}:`, searchError.message);
                }
            }
            
            if (!searchResult && attempts < maxAttempts) {
                if (attempts === 1 && isURL(query)) {
                    query = query.split('?')[0];
                } else if (attempts === 2 && !isURL(originalQuery)) {
                    query = originalQuery + " official";
                }
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        if (!searchResult || !searchResult.tracks.length) {
            return message.reply(`❌ Tidak ditemukan hasil untuk: **${originalQuery}**`);
        }

        const { track } = await player.play(voiceChannel, searchResult, {
            nodeOptions: {
                metadata: {
                    channel: message.channel,
                    textChannelId: message.channel.id,
                    guild: message.guild,
                },
                selfDeafen: true,
                volume: globalState.volume,
                leaveOnEnd: false,
                leaveOnStop: false,
                leaveOnEmpty: false,
                leaveOnEmptyCooldown: 30000,
            },
        });

        const queue = player.queues.get(message.guild.id);
        updateGlobalState(queue);
        
        if (!track.playlist && queue && queue.tracks.size > 0 && queue.currentTrack !== track) {
            await message.reply(`✅ Ditambahkan ke antrian: **${track.title}**\n📊 Posisi dalam antrian: ${queue.tracks.size}`);
        }
        
    } catch (e) {
        console.error(`❌ Error playing song:`, e);
        await message.reply(`❌ Maaf, tidak bisa memutar lagu itu: ${e.message}`);
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
    updateGlobalState(queue);
    
    return message.reply(`⏭️ Lagu di-skip: **${currentTrack?.title || 'Unknown'}**\n📊 Lagu tersisa dalam antrian: ${queue.tracks.size}`);
  }

  // Stop
  if (message.content.startsWith("!stop")) {
    const queue = player.queues.get(message.guild.id);
    if (!queue || !queue.isPlaying()) {
      return message.reply("❌ Tidak ada lagu yang sedang diputar.");
    }
    
    try {
        const currentTrack = queue.currentTrack;
        queue.delete();
        globalState.loopMode = 'off'; // Reset loop when stopping
        updateGlobalState(null);
        return message.reply(`⏹️ Playback dihentikan: **${currentTrack?.title || 'Unknown'}**\n🚪 Bot keluar dari voice channel.`);
    } catch (error) {
        console.error("❌ Error stopping queue:", error);
        return message.reply("❌ Terjadi kesalahan saat menghentikan playback.");
    }
  }

  // Queue
  if (message.content.startsWith("!queue")) {
    const queue = player.queues.get(message.guild.id);
    if (!queue || (!queue.currentTrack && queue.tracks.size === 0)) {
        return message.reply("❌ Antrian kosong.");
    }

    const embed = new EmbedBuilder()
        .setColor('#0099FF')
        .setTitle('📋 Music Queue')
        .addFields({ name: '🔄 Loop Mode', value: globalState.loopMode.toUpperCase(), inline: true });

    if (queue.currentTrack) {
        embed.addFields({ 
            name: '🎶 Currently Playing', 
            value: `${queue.currentTrack.title} - ${queue.currentTrack.author}\n⏱️ ${queue.currentTrack.duration}`, 
            inline: false 
        });
    }

    if (queue.tracks.size > 0) {
        const queueList = queue.tracks.map((track, i) => 
            `${i + 1}. ${track.title} - ${track.author} (${track.duration})`
        ).slice(0, 10).join('\n');
        
        embed.addFields({ 
            name: `📋 Up Next (${queue.tracks.size} songs)`, 
            value: queueList + (queue.tracks.size > 10 ? `\n...and ${queue.tracks.size - 10} more` : ''), 
            inline: false 
        });
    }

    const row = createControlButtons();
    return message.reply({ embeds: [embed], components: [row] });
  }
});

// Dashboard API Routes
app.get('/api/status', (req, res) => {
    res.json(globalState);
});

app.post('/api/control', async (req, res) => {
    const { action, guildId } = req.body;
    
    if (!guildId) {
        return res.status(400).json({ error: 'Guild ID required' });
    }
    
    const queue = player.queues.get(guildId);
    
    try {
        switch (action) {
            case 'play':
                if (queue && queue.node.isPaused()) {
                    queue.node.resume();
                    updateGlobalState(queue);
                    res.json({ success: true, message: 'Resumed' });
                } else {
                    res.status(400).json({ error: 'Nothing to resume' });
                }
                break;
                
            case 'pause':
                if (queue && queue.isPlaying() && !queue.node.isPaused()) {
                    queue.node.pause();
                    updateGlobalState(queue);
                    res.json({ success: true, message: 'Paused' });
                } else {
                    res.status(400).json({ error: 'Nothing to pause' });
                }
                break;
                
            case 'skip':
                if (queue && queue.isPlaying()) {
                    queue.skip();
                    updateGlobalState(queue);
                    res.json({ success: true, message: 'Skipped' });
                } else {
                    res.status(400).json({ error: 'Nothing to skip' });
                }
                break;
                
            case 'stop':
                if (queue) {
                    queue.delete();
                    globalState.loopMode = 'off';
                    updateGlobalState(null);
                    res.json({ success: true, message: 'Stopped' });
                } else {
                    res.status(400).json({ error: 'Nothing to stop' });
                }
                break;
                
            case 'loop':
                const { mode } = req.body;
                if (['off', 'track', 'queue'].includes(mode)) {
                    globalState.loopMode = mode;
                    res.json({ success: true, message: `Loop mode set to ${mode}` });
                } else {
                    res.status(400).json({ error: 'Invalid loop mode' });
                }
                break;
                
            default:
                res.status(400).json({ error: 'Invalid action' });
        }
    } catch (error) {
        console.error('API control error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Serve dashboard
app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>🎵 Kugy Bot Dashboard</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white; 
            min-height: 100vh;
            padding: 20px;
        }
        .container { 
            max-width: 800px; 
            margin: 0 auto; 
            background: rgba(255,255,255,0.1); 
            backdrop-filter: blur(10px);
            border-radius: 20px; 
            padding: 30px; 
            box-shadow: 0 8px 32px rgba(0,0,0,0.3);
        }
        h1 { 
            text-align: center; 
            margin-bottom: 30px; 
            font-size: 2.5em;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.5);
        }
        .status { 
            background: rgba(255,255,255,0.2); 
            padding: 20px; 
            border-radius: 15px; 
            margin-bottom: 30px;
            border: 1px solid rgba(255,255,255,0.3);
        }
        .controls { 
            display: grid; 
            grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); 
            gap: 15px; 
            margin-bottom: 30px;
        }
        button { 
            padding: 15px 20px; 
            border: none; 
            border-radius: 12px; 
            font-size: 16px; 
            font-weight: bold;
            cursor: pointer; 
            transition: all 0.3s ease;
            background: linear-gradient(45deg, #4CAF50, #45a049);
            color: white;
            box-shadow: 0 4px 15px rgba(0,0,0,0.2);
        }
        button:hover { 
            transform: translateY(-2px); 
            box-shadow: 0 6px 20px rgba(0,0,0,0.3);
        }
        button:active { transform: translateY(0); }
        .btn-pause { background: linear-gradient(45deg, #ff9800, #f57c00) !important; }
        .btn-skip { background: linear-gradient(45deg, #2196F3, #1976D2) !important; }
        .btn-stop { background: linear-gradient(45deg, #f44336, #d32f2f) !important; }
        .btn-loop { background: linear-gradient(45deg, #9c27b0, #7b1fa2) !important; }
        .btn-loop.active { background: linear-gradient(45deg, #4CAF50, #388e3c) !important; }
        .queue { 
            background: rgba(255,255,255,0.2); 
            padding: 20px; 
            border-radius: 15px;
            border: 1px solid rgba(255,255,255,0.3);
        }
        .track { 
            padding: 10px; 
            margin: 5px 0; 
            background: rgba(255,255,255,0.1); 
            border-radius: 8px;
            border-left: 4px solid #4CAF50;
        }
        .current-track { 
            border-left-color: #ff9800; 
            background: rgba(255,152,0,0.2);
        }
        .loop-selector {
            display: flex;
            gap: 10px;
            margin-top: 15px;
        }
        .loop-btn {
            flex: 1;
            padding: 10px;
            font-size: 14px;
        }
        .status-indicator {
            display: inline-block;
            width: 12px;
            height: 12px;
            border-radius: 50%;
            margin-right: 8px;
        }
        .playing { background-color: #4CAF50; }
        .paused { background-color: #ff9800; }
        .stopped { background-color: #f44336; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🎵 Kugy Bot Dashboard</h1>
        
        <div class="status">
            <h2>📊 Status</h2>
            <p><span id="status-indicator" class="status-indicator stopped"></span><strong>Status:</strong> <span id="status">Stopped</span></p>
            <p><strong>🎵 Current Track:</strong> <span id="current-track">None</span></p>
            <p><strong>🔄 Loop Mode:</strong> <span id="loop-mode">OFF</span></p>
            <p><strong>📋 Queue Size:</strong> <span id="queue-size">0</span></p>
        </div>
        
        <div class="controls">
            <button id="play-btn" onclick="control('play')">▶️ Play</button>
            <button id="pause-btn" onclick="control('pause')" class="btn-pause">⏸️ Pause</button>
            <button onclick="control('skip')" class="btn-skip">⏭️ Skip</button>
            <button onclick="control('stop')" class="btn-stop">⏹️ Stop</button>
        </div>
        
        <div class="status">
            <h3>🔄 Loop Control</h3>
            <div class="loop-selector">
                <button onclick="setLoop('off')" class="loop-btn" id="loop-off">⏹️ OFF</button>
                <button onclick="setLoop('track')" class="loop-btn btn-loop" id="loop-track">🎵 TRACK</button>
                <button onclick="setLoop('queue')" class="loop-btn btn-loop" id="loop-queue">📋 QUEUE</button>
            </div>
        </div>
        
        <div class="queue">
            <h2>📋 Queue</h2>
            <div id="queue-list">No tracks in queue</div>
        </div>
    </div>

    <script>
        let currentGuildId = null;
        
        async function updateStatus() {
            try {
                const response = await fetch('/api/status');
                const data = await response.json();
                
                currentGuildId = data.guildId;
                
                // Update status
                const statusEl = document.getElementById('status');
                const indicatorEl = document.getElementById('status-indicator');
                
                if (data.isPlaying) {
                    statusEl.textContent = 'Playing';
                    indicatorEl.className = 'status-indicator playing';
                } else if (data.currentTrack) {
                    statusEl.textContent = 'Paused';
                    indicatorEl.className = 'status-indicator paused';
                } else {
                    statusEl.textContent = 'Stopped';
                    indicatorEl.className = 'status-indicator stopped';
                }
                
                // Update current track
                document.getElementById('current-track').textContent = 
                    data.currentTrack ? \`\${data.currentTrack.title} - \${data.currentTrack.author}\` : 'None';
                
                // Update loop mode
                document.getElementById('loop-mode').textContent = data.loopMode.toUpperCase();
                
                // Update loop buttons
                document.querySelectorAll('.loop-btn').forEach(btn => btn.classList.remove('active'));
                document.getElementById(\`loop-\${data.loopMode}\`).classList.add('active');
                
                // Update queue
                document.getElementById('queue-size').textContent = data.queue.length;
                
                const queueList = document.getElementById('queue-list');
                if (data.currentTrack || data.queue.length > 0) {
                    let html = '';
                    
                    if (data.currentTrack) {
                        html += \`<div class="track current-track">
                            🎵 <strong>\${data.currentTrack.title}</strong> - \${data.currentTrack.author}
                            <br><small>⏱️ \${data.currentTrack.duration}</small>
                        </div>\`;
                    }
                    
                    data.queue.forEach((track, i) => {
                        html += \`<div class="track">
                            \${i + 1}. <strong>\${track.title}</strong> - \${track.author}
                            <br><small>⏱️ \${track.duration}</small>
                        </div>\`;
                    });
                    
                    queueList.innerHTML = html;
                } else {
                    queueList.innerHTML = 'No tracks in queue';
                }
                
            } catch (error) {
                console.error('Error updating status:', error);
            }
        }
        
        async function control(action) {
            if (!currentGuildId) {
                alert('No active guild found. Please play a song first in Discord.');
                return;
            }
            
            try {
                const response = await fetch('/api/control', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action, guildId: currentGuildId })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    updateStatus();
                } else {
                    alert(data.error);
                }
            } catch (error) {
                console.error('Control error:', error);
                alert('Error controlling bot');
            }
        }
        
        async function setLoop(mode) {
            if (!currentGuildId) {
                // Allow setting loop mode even without active guild
                try {
                    const response = await fetch('/api/control', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'loop', mode, guildId: 'global' })
                    });
                    
                    const data = await response.json();
                    if (data.success) {
                        updateStatus();
                    }
                } catch (error) {
                    console.error('Loop error:', error);
                }
                return;
            }
            
            try {
                const response = await fetch('/api/control', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'loop', mode, guildId: currentGuildId })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    updateStatus();
                } else {
                    alert(data.error);
                }
            } catch (error) {
                console.error('Loop error:', error);
                alert('Error setting loop mode');
            }
        }
        
        // Update status every 2 seconds
        setInterval(updateStatus, 2000);
        updateStatus();
    </script>
</body>
</html>
    `);
});

// Start dashboard server
const PORT = process.env.DASHBOARD_PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 Dashboard server running on http://localhost:${PORT}`);
});

client.login(process.env.DISCORD_TOKEN);