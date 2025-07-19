import { Client, GatewayIntentBits, Partials, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from "discord.js";
import { DisTube } from "distube";
import { SpotifyPlugin } from "@distube/spotify";
import { YtDlpPlugin } from "@distube/yt-dlp";
import mongoose from "mongoose";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
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

// CRITICAL FIX: Menggunakan DisTube sebagai pengganti discord-player
console.log("🎵 Discord Music Bot - DISTUBE VERSION");

// Check FFmpeg availability
function checkFFmpeg() {
    try {
        execSync('ffmpeg -version', { stdio: 'pipe' });
        console.log("✅ FFmpeg found in system PATH");
        return 'system';
    } catch (error) {
        console.log("⚠️ FFmpeg not found in system PATH, trying ffmpeg-static...");
        try {
            const ffmpegStatic = require('ffmpeg-static');
            if (ffmpegStatic) {
                console.log(`✅ FFmpeg-static found: ${ffmpegStatic}`);
                return ffmpegStatic;
            }
        } catch (e) {
            console.log("⚠️ ffmpeg-static not available, trying @ffmpeg-installer/ffmpeg...");
            try {
                const ffmpeg = require('@ffmpeg-installer/ffmpeg');
                if (ffmpeg.path) {
                    console.log(`✅ @ffmpeg-installer/ffmpeg found: ${ffmpeg.path}`);
                    return ffmpeg.path;
                }
            } catch (e2) {
                console.error("❌ No FFmpeg found! Installing ffmpeg-static...");
                try {
                    execSync('npm install ffmpeg-static --save', { stdio: 'inherit' });
                    const ffmpegStatic = require('ffmpeg-static');
                    console.log(`✅ FFmpeg-static installed: ${ffmpegStatic}`);
                    return ffmpegStatic;
                } catch (installError) {
                    console.error("❌ Failed to install ffmpeg-static:", installError.message);
                    return null;
                }
            }
        }
    }
}

const ffmpegPath = checkFFmpeg();

// Inisialisasi DisTube dengan plugin
const distube = new DisTube(client, {
  leaveOnStop: false,
  leaveOnFinish: false,
  leaveOnEmpty: true,
  emitNewSongOnly: true,
  emitAddSongWhenCreatingQueue: false,
  emitAddListWhenCreatingQueue: false,
  plugins: [
    new SpotifyPlugin({
      emitEventsAfterFetching: true,
    }),
    new YtDlpPlugin(),
  ],
  ytdlOptions: {
    quality: 'highestaudio',
    highWaterMark: 1 << 25,
    filter: 'audioonly',
  },
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

// Function untuk update global state
function updateGlobalState(queue) {
    if (queue) {
        globalState.isPlaying = !queue.paused;
        globalState.currentTrack = queue.songs[0] ? {
            title: queue.songs[0].name,
            author: queue.songs[0].uploader?.name || 'Unknown',
            duration: queue.songs[0].formattedDuration,
            url: queue.songs[0].url
        } : null;
        globalState.queue = queue.songs.slice(1).map(song => ({
            title: song.name,
            author: song.uploader?.name || 'Unknown',
            duration: song.formattedDuration
        }));
        globalState.guildId = queue.id;
        globalState.voiceChannelId = queue.voiceChannel?.id;
        globalState.volume = queue.volume;
        // DisTube menggunakan repeatMode: 0 = off, 1 = song, 2 = queue
        globalState.loopMode = queue.repeatMode === 0 ? 'off' : (queue.repeatMode === 1 ? 'track' : 'queue');
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

// DisTube Event Handlers
distube.on("playSong", (queue, song) => {
    console.log(`🎶 Now playing: ${song.name} - ${song.uploader?.name || 'Unknown'}`);
    console.log(`⏱️ Duration: ${song.formattedDuration}`);
    console.log(`🔊 Audio URL: ${song.url ? 'Available' : 'Not Available'}`);
    console.log(`🔄 Loop mode: ${globalState.loopMode}`);
    
    // Voice Connection Validation
    console.log(`🔗 Voice Connection: ${queue.voiceChannel ? 'Active' : 'Missing'}`);
    
    updateGlobalState(queue);
    
    const textChannel = queue.textChannel;
    if (textChannel) {
        const embed = new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle('🎶 Now Playing')
            .setDescription(`**${song.name}**\nby ${song.uploader?.name || 'Unknown'}`)
            .addFields(
                { name: '⏱️ Duration', value: song.formattedDuration, inline: true },
                { name: '🔄 Loop Mode', value: globalState.loopMode.toUpperCase(), inline: true },
                { name: '🔗 Connection', value: queue.voiceChannel ? '✅ Connected' : '❌ Disconnected', inline: true }
            )
            .setThumbnail(song.thumbnail);
            
        const row = createControlButtons();
        
        textChannel.send({ 
            embeds: [embed], 
            components: [row] 
        });
    }
});

distube.on("addSong", (queue, song) => {
    console.log(`📥 Track added to queue: ${song.name}`);
    updateGlobalState(queue);
    
    if (queue.songs.length > 1) { // Only send message if it's not the first song (which triggers playSong)
        queue.textChannel?.send(`✅ Ditambahkan ke antrian: **${song.name}** - ${song.formattedDuration}`);
    }
});

distube.on("addList", (queue, playlist) => {
    console.log(`📥 Playlist added to queue: ${playlist.name}, ${playlist.songs.length} songs`);
    updateGlobalState(queue);
    
    queue.textChannel?.send(`✅ Ditambahkan playlist ke antrian: **${playlist.name}** (${playlist.songs.length} lagu)`);
});

distube.on("error", (channel, error) => {
    console.error(`❌ DisTube error:`, error);
    channel?.send(`❌ Error: ${error.message}`);
});

distube.on("finish", (queue) => {
    console.log(`✅ Queue finished`);
    updateGlobalState(null);
    queue.textChannel?.send("🎵 Semua lagu telah selesai diputar.");
});

distube.on("disconnect", (queue) => {
    console.log(`🔌 Disconnected from voice channel`);
    updateGlobalState(null);
    queue.textChannel?.send("🔌 Bot telah terputus dari voice channel.");
});

distube.on("empty", (queue) => {
    console.log(`🔈 Voice channel empty`);
    updateGlobalState(null);
    queue.textChannel?.send("🔈 Voice channel kosong, meninggalkan channel...");
});

client.once("ready", () => {
  console.log(`✅ Bot is ready! Logged in as ${client.user.tag}`);
  console.log(`🎵 Music system: DisTube`);
  console.log(`🔧 FFmpeg: ${ffmpegPath || 'Not configured'}`);
  
  // Set bot status
  client.user.setActivity("!help | Music with DisTube", { type: "LISTENING" });
  
  // Check if MongoDB is connected
  if (mongoose.connection.readyState === 1) {
    console.log(`📊 MongoDB connected: ${mongoose.connection.name}`);
  }
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;
  
  const guildId = interaction.guildId;
  const queue = distube.getQueue(guildId);
  
  switch (interaction.customId) {
    case 'music_play_pause':
      if (queue) {
        if (queue.paused) {
          queue.resume();
          await interaction.reply({ content: '▶️ Resumed playback', ephemeral: true });
        } else {
          queue.pause();
          await interaction.reply({ content: '⏸️ Paused playback', ephemeral: true });
        }
        updateGlobalState(queue);
      } else {
        await interaction.reply({ content: '❌ No active queue', ephemeral: true });
      }
      break;
      
    case 'music_skip':
      if (queue) {
        try {
          await queue.skip();
          await interaction.reply({ content: '⏭️ Skipped song', ephemeral: true });
        } catch (error) {
          await interaction.reply({ content: `❌ Error: ${error.message}`, ephemeral: true });
        }
      } else {
        await interaction.reply({ content: '❌ No active queue', ephemeral: true });
      }
      break;
      
    case 'music_stop':
      if (queue) {
        queue.stop();
        updateGlobalState(null);
        await interaction.reply({ content: '⏹️ Stopped playback', ephemeral: true });
      } else {
        await interaction.reply({ content: '❌ No active queue', ephemeral: true });
      }
      break;
      
    case 'music_loop':
      if (queue) {
        // DisTube: 0 = off, 1 = song, 2 = queue
        let newMode;
        if (queue.repeatMode === 0) {
          newMode = 1; // off -> track
        } else if (queue.repeatMode === 1) {
          newMode = 2; // track -> queue
        } else {
          newMode = 0; // queue -> off
        }
        
        queue.setRepeatMode(newMode);
        
        const modes = ['OFF', 'TRACK', 'QUEUE'];
        await interaction.reply({ content: `🔄 Loop mode set to: ${modes[newMode]}`, ephemeral: true });
        
        updateGlobalState(queue);
      } else {
        await interaction.reply({ content: '❌ No active queue', ephemeral: true });
      }
      break;
      
    case 'music_queue':
      if (queue) {
        const currentSong = queue.songs[0];
        
        const embed = new EmbedBuilder()
            .setColor('#0099FF')
            .setTitle('📋 Music Queue')
            .addFields({ name: '🔄 Loop Mode', value: globalState.loopMode.toUpperCase(), inline: true });
        
        if (currentSong) {
            embed.addFields({ 
                name: '🎶 Currently Playing', 
                value: `${currentSong.name} - ${currentSong.formattedDuration}`, 
                inline: false 
            });
        }
        
        if (queue.songs.length > 1) {
            const queueList = queue.songs
                .slice(1)
                .map((song, i) => `${i + 1}. ${song.name} - ${song.formattedDuration}`)
                .slice(0, 10)
                .join('\n');
            
            embed.addFields({ 
                name: `📋 Up Next (${queue.songs.length - 1} songs)`, 
                value: queueList + (queue.songs.length > 11 ? `\n...and ${queue.songs.length - 11} more` : ''), 
                inline: false 
            });
        }
        
        const row = createControlButtons();
        await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
      } else {
        await interaction.reply({ content: '❌ No active queue', ephemeral: true });
      }
      break;
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

  // Audio resource check command
  if (message.content === "!audio") {
    const queue = distube.getQueue(message.guild.id);
    const embed = new EmbedBuilder()
        .setColor(queue ? '#00FF00' : '#FF0000')
        .setTitle('🎵 Audio Status');
    
    if (queue) {
        embed.addFields(
            { name: '🔗 Voice Connection', value: queue.voiceChannel ? '✅ Connected' : '❌ Disconnected', inline: true },
            { name: '🎵 Status', value: queue.paused ? '⏸️ Paused' : '▶️ Playing', inline: true },
            { name: '🎶 Current Track', value: queue.songs[0]?.name || 'None', inline: true },
            { name: '📊 Queue Size', value: queue.songs.length.toString(), inline: true },
            { name: '🔄 Loop Mode', value: globalState.loopMode.toUpperCase(), inline: true },
            { name: '🔊 Volume', value: `${queue.volume}%`, inline: true }
        );
    } else {
        embed.addFields({ 
            name: '📊 Status', 
            value: '❌ No active queue', 
            inline: false 
        });
    }
    
    return message.reply({ embeds: [embed] });
  }

  // FFmpeg check command
  if (message.content === "!ffmpeg") {
    const embed = new EmbedBuilder()
        .setColor(ffmpegPath ? '#00FF00' : '#FF0000')
        .setTitle('🔧 FFmpeg Status')
        .addFields(
            { name: '📊 Status', value: ffmpegPath ? '✅ Configured' : '❌ Missing', inline: true },
            { name: '📁 Path', value: ffmpegPath || 'Not found', inline: true },
            { name: '🎵 Audio Support', value: ffmpegPath ? '✅ Available' : '❌ Unavailable', inline: true }
        );
    
    if (!ffmpegPath) {
        embed.addFields({ 
            name: '💡 Installation Commands', 
            value: '**Ubuntu/Debian:**\n```sudo apt update && sudo apt install ffmpeg```\n**CentOS/RHEL:**\n```sudo yum install ffmpeg```\n**NPM Alternative:**\n```npm install ffmpeg-static```', 
            inline: false 
        });
    }
    
    return message.reply({ embeds: [embed] });
  }

  // HELP COMMAND
  if (message.content === "!help") {
    const embed = new EmbedBuilder()
        .setColor('#0099FF')
        .setTitle('📜 Command List')
        .setDescription('Daftar command yang tersedia:')
        .addFields(
            { name: '🎵 Music Commands', value: '`!play <url/nama_lagu>` - Play musik\n`!skip` - Skip lagu\n`!stop` - Stop musik\n`!queue` - Lihat antrian\n`!loop <off/track/queue>` - Set loop mode', inline: false },
            { name: '🤖 Other Commands', value: '`!chat <pesan>` - Chat dengan AI\n`!help` - Tampilkan help\n`!ffmpeg` - Check FFmpeg status\n`!audio` - Check audio status', inline: false },
            { name: '🎛️ Dashboard Features', value: '• Control buttons untuk play/pause/skip/stop\n• Loop mode: OFF/TRACK/QUEUE\n• Real-time queue display\n• Web dashboard di http://localhost:3000', inline: false },
            { name: '🔧 Music System', value: '• Menggunakan DisTube\n• Support untuk YouTube, Spotify, SoundCloud\n• Enhanced audio stability\n• Playlist support', inline: false }
        );
    
    return message.reply({ embeds: [embed] });
  }

  // Loop command
  if (message.content.startsWith("!loop ")) {
    const mode = message.content.slice("!loop ".length).trim().toLowerCase();
    const queue = distube.getQueue(message.guild.id);
    
    if (!queue) {
      return message.reply('❌ Tidak ada lagu yang sedang diputar.');
    }
    
    if (!['off', 'track', 'queue'].includes(mode)) {
        return message.reply('❌ Mode loop tidak valid. Gunakan: `off`, `track`, atau `queue`');
    }
    
    // DisTube: 0 = off, 1 = song, 2 = queue
    let repeatMode;
    switch (mode) {
      case 'off':
        repeatMode = 0;
        break;
      case 'track':
        repeatMode = 1;
        break;
      case 'queue':
        repeatMode = 2;
        break;
    }
    
    queue.setRepeatMode(repeatMode);
    updateGlobalState(queue);
    
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

  // PLAY COMMAND dengan DisTube
  if (message.content.startsWith("!play ")) {
    // Check FFmpeg first
    if (!ffmpegPath) {
        return message.reply(`❌ **FFmpeg tidak ditemukan!** Audio tidak akan berfungsi.\n\n🔧 **Install FFmpeg:**\n\`\`\`bash\n# Ubuntu/Debian\nsudo apt update && sudo apt install ffmpeg\n\n# CentOS/RHEL\nsudo yum install ffmpeg\n\n# NPM Alternative\nnpm install ffmpeg-static\n\`\`\`\n\nSetelah install, restart bot dengan \`pm2 restart kugy-bot\``);
    }
    
    const voiceChannel = message.member?.voice.channel;
    if (!voiceChannel) {
        return message.reply("❌ Kamu harus join voice channel dulu.");
    }

    // Check voice channel permissions
    const permissions = voiceChannel.permissionsFor(message.guild.members.me);
    if (!permissions.has('Connect') || !permissions.has('Speak')) {
        return message.reply(`❌ **Bot tidak punya permission di voice channel!**\n🔧 Bot butuh permission:\n• \`Connect\` - Untuk join voice channel\n• \`Speak\` - Untuk memutar audio\n\n💡 Minta admin server untuk memberikan permission ini.`);
    }

    let query = message.content.slice("!play ".length).trim();
    if (!query) {
        return message.reply('Tolong berikan nama lagu atau link YouTube!');
    }

    query = cleanYouTubeURL(query);
    
    console.log(`🔍 Searching: ${query}`);
    console.log(`🔊 Voice channel: ${voiceChannel.name} (${voiceChannel.id})`);
    console.log(`🔧 FFmpeg path: ${ffmpegPath}`);
    
    try {
        message.channel.send(`🔍 Mencari: **${query}**`);
        
        // DisTube play
        await distube.play(voiceChannel, query, {
            member: message.member,
            textChannel: message.channel,
            metadata: {
                channel: message.channel,
                guild: message.guild,
            }
        });
        
        // DisTube akan mengirim pesan melalui event handler
    } catch (e) {
        console.error(`❌ Error playing song:`, e);
        
        let errorMessage = `❌ Maaf, tidak bisa memutar lagu itu: ${e.message}\n\n💡 **Troubleshooting:**\n`;
        
        if (e.message.includes('audio') || e.message.includes('resource')) {
            errorMessage += `🎵 **Audio Error!**\n• Coba \`!play\` lagi\n• Check \`!audio\` untuk status\n• Check \`!ffmpeg\` untuk FFmpeg status\n• Restart bot jika masalah berlanjut`;
        } else {
            errorMessage += `• Pastikan FFmpeg terinstall: \`!ffmpeg\`\n• Coba dengan URL YouTube yang berbeda\n• Gunakan nama lagu yang lebih spesifik\n• Check audio status: \`!audio\`\n• Restart bot jika masalah berlanjut`;
        }
        
        await message.reply(errorMessage);
    }
  }

  // Skip
  if (message.content.startsWith("!skip")) {
    const queue = distube.getQueue(message.guild.id);
    if (!queue) {
        return message.reply("❌ Tidak ada lagu yang sedang diputar atau di antrian.");
    }
    
    try {
        const currentSong = queue.songs[0];
        await queue.skip();
        updateGlobalState(queue);
        
        return message.reply(`⏭️ Lagu di-skip: **${currentSong?.name || 'Unknown'}**`);
    } catch (error) {
        console.error("❌ Error skipping:", error);
        return message.reply(`❌ Error: ${error.message}`);
    }
  }

  // Stop
  if (message.content.startsWith("!stop")) {
    const queue = distube.getQueue(message.guild.id);
    if (!queue) {
      return message.reply("❌ Tidak ada lagu yang sedang diputar.");
    }
    
    try {
        const currentSong = queue.songs[0];
        queue.stop();
        updateGlobalState(null);
        return message.reply(`⏹️ Playback dihentikan: **${currentSong?.name || 'Unknown'}**\n🚪 Bot keluar dari voice channel.`);
    } catch (error) {
        console.error("❌ Error stopping queue:", error);
        return message.reply("❌ Terjadi kesalahan saat menghentikan playback.");
    }
  }

  // Queue
  if (message.content.startsWith("!queue")) {
    const queue = distube.getQueue(message.guild.id);
    if (!queue || queue.songs.length === 0) {
        return message.reply("❌ Antrian kosong.");
    }

    const embed = new EmbedBuilder()
        .setColor('#0099FF')
        .setTitle('📋 Music Queue')
        .addFields({ name: '🔄 Loop Mode', value: globalState.loopMode.toUpperCase(), inline: true });

    if (queue.songs[0]) {
        embed.addFields({ 
            name: '🎶 Currently Playing', 
            value: `${queue.songs[0].name} - ${queue.songs[0].formattedDuration}`, 
            inline: false 
        });
    }

    if (queue.songs.length > 1) {
        const queueList = queue.songs
            .slice(1)
            .map((song, i) => `${i + 1}. ${song.name} - ${song.formattedDuration}`)
            .slice(0, 10)
            .join('\n');
        
        embed.addFields({ 
            name: `📋 Up Next (${queue.songs.length - 1} songs)`, 
            value: queueList + (queue.songs.length > 11 ? `\n...and ${queue.songs.length - 11} more` : ''), 
            inline: false 
        });
    }

    const row = createControlButtons();
    return message.reply({ embeds: [embed], components: [row] });
  }
});

// Dashboard API Routes
app.get('/api/status', (req, res) => {
    const queue = globalState.guildId ? distube.getQueue(globalState.guildId) : null;
    res.json({
        ...globalState,
        ffmpegStatus: ffmpegPath ? 'configured' : 'missing',
        ffmpegPath: ffmpegPath || null,
        voiceConnectionStatus: queue?.voiceChannel ? 'connected' : 'disconnected',
        audioResourceStatus: queue ? 'active' : 'missing'
    });
});

app.post('/api/control', async (req, res) => {
    const { action, guildId } = req.body;
    
    if (!guildId) {
        return res.status(400).json({ error: 'Guild ID required' });
    }
    
    const queue = distube.getQueue(guildId);
    
    try {
        switch (action) {
            case 'play':
                if (queue && queue.paused) {
                    queue.resume();
                    updateGlobalState(queue);
                    res.json({ success: true, message: 'Resumed' });
                } else {
                    res.status(400).json({ error: 'Nothing to resume' });
                }
                break;
                
            case 'pause':
                if (queue && !queue.paused) {
                    queue.pause();
                    updateGlobalState(queue);
                    res.json({ success: true, message: 'Paused' });
                } else {
                    res.status(400).json({ error: 'Nothing to pause' });
                }
                break;
                
            case 'skip':
                if (queue) {
                    await queue.skip();
                    updateGlobalState(queue);
                    res.json({ success: true, message: 'Skipped' });
                } else {
                    res.status(400).json({ error: 'Nothing to skip' });
                }
                break;
                
            case 'stop':
                if (queue) {
                    queue.stop();
                    updateGlobalState(null);
                    res.json({ success: true, message: 'Stopped' });
                } else {
                    res.status(400).json({ error: 'Nothing to stop' });
                }
                break;
                
            case 'loop':
                const { mode } = req.body;
                if (queue) {
                    let repeatMode;
                    switch (mode) {
                        case 'off':
                            repeatMode = 0;
                            break;
                        case 'track':
                            repeatMode = 1;
                            break;
                        case 'queue':
                            repeatMode = 2;
                            break;
                        default:
                            return res.status(400).json({ error: 'Invalid loop mode' });
                    }
                    
                    queue.setRepeatMode(repeatMode);
                    updateGlobalState(queue);
                    res.json({ success: true, message: `Loop mode set to ${mode}` });
                } else {
                    res.status(400).json({ error: 'No active queue' });
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

// Serve dashboard with audio resource status
app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>🎵 Kugy Bot Dashboard - DisTube Version</title>
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
            transition: all 0.3s;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }
        button:hover { 
            transform: translateY(-3px); 
            box-shadow: 0 6px 8px rgba(0,0,0,0.2);
        }
        .play { background: #4CAF50; color: white; }
        .pause { background: #FFC107; color: black; }
        .skip { background: #2196F3; color: white; }
        .stop { background: #F44336; color: white; }
        .queue { background: #9C27B0; color: white; }
        .loop { background: #FF9800; color: black; }
        .queue-list {
            max-height: 300px;
            overflow-y: auto;
            background: rgba(0,0,0,0.2);
            border-radius: 10px;
            padding: 15px;
            margin-top: 20px;
        }
        .queue-item {
            padding: 10px;
            border-bottom: 1px solid rgba(255,255,255,0.1);
            display: flex;
            justify-content: space-between;
        }
        .current-song {
            background: rgba(76, 175, 80, 0.3);
            border-radius: 8px;
            padding: 15px;
            margin-bottom: 15px;
        }
        .badge {
            display: inline-block;
            padding: 5px 10px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: bold;
            margin-left: 10px;
        }
        .badge-success { background: #4CAF50; color: white; }
        .badge-warning { background: #FFC107; color: black; }
        .badge-danger { background: #F44336; color: white; }
        .badge-info { background: #2196F3; color: white; }
        .footer {
            text-align: center;
            margin-top: 30px;
            font-size: 14px;
            opacity: 0.7;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🎵 Kugy Bot Dashboard</h1>
        <div class="status" id="status">
            <h2>Loading status...</h2>
        </div>
        
        <div class="controls">
            <button class="play" onclick="control('play')">▶️ Play</button>
            <button class="pause" onclick="control('pause')">⏸️ Pause</button>
            <button class="skip" onclick="control('skip')">⏭️ Skip</button>
            <button class="stop" onclick="control('stop')">⏹️ Stop</button>
        </div>
        
        <div class="loop-controls">
            <h3>🔄 Loop Mode</h3>
            <div class="controls">
                <button onclick="setLoop('off')" id="loop-off">OFF</button>
                <button onclick="setLoop('track')" id="loop-track">TRACK</button>
                <button onclick="setLoop('queue')" id="loop-queue">QUEUE</button>
            </div>
        </div>
        
        <div id="queue-container"></div>
        
        <div class="footer">
            <p>Powered by DisTube | FFmpeg Status: <span id="ffmpeg-status">Checking...</span></p>
        </div>
    </div>

    <script>
        let currentGuildId = null;
        
        async function updateStatus() {
            try {
                const response = await fetch('/api/status');
                const data = await response.json();
                
                currentGuildId = data.guildId;
                
                // Update status display
                let statusHtml = '';
                
                if (data.currentTrack) {
                    statusHtml = statusHtml + '<div class="current-song">' +
                        '<h2>🎵 Now Playing</h2>' +
                        '<h3>' + data.currentTrack.title + '</h3>' +
                        '<p>by ' + data.currentTrack.author + ' • ' + data.currentTrack.duration + '</p>' +
                        '<p>' +
                        'Status: ' + (data.isPlaying ? 
                            '<span class="badge badge-success">Playing</span>' : 
                            '<span class="badge badge-warning">Paused</span>') +
                        ' Loop: <span class="badge badge-info">' + data.loopMode.toUpperCase() + '</span>' +
                        ' Connection: ' + (data.voiceConnectionStatus === 'connected' ? 
                            '<span class="badge badge-success">Connected</span>' : 
                            '<span class="badge badge-danger">Disconnected</span>') +
                        '</p>' +
                        '</div>';
                } else {
                    statusHtml = statusHtml + '<div>' +
                        '<h2>🔈 Not Playing</h2>' +
                        '<p>Use !play command to play music</p>' +
                        '</div>';
                }
                
                document.getElementById('status').innerHTML = statusHtml;
                
                // Update queue display
                let queueHtml = '';
                
                if (data.queue && data.queue.length > 0) {
                    queueHtml = queueHtml + '<h3>📋 Queue (' + data.queue.length + ' songs)</h3>' +
                        '<div class="queue-list">';
                    
                    data.queue.forEach((track, index) => {
                        queueHtml = queueHtml + '<div class="queue-item">' +
                            '<div>' + (index + 1) + '. ' + track.title + '</div>' +
                            '<div>' + track.duration + '</div>' +
                            '</div>';
                    });
                    
                    queueHtml = queueHtml + '</div>';
                } else if (data.currentTrack) {
                    queueHtml = queueHtml + '<h3>📋 Queue is empty</h3>';
                }
                
                document.getElementById('queue-container').innerHTML = queueHtml;
                
                // Update loop buttons
                document.getElementById('loop-off').className = data.loopMode === 'off' ? 'active' : '';
                document.getElementById('loop-track').className = data.loopMode === 'track' ? 'active' : '';
                document.getElementById('loop-queue').className = data.loopMode === 'queue' ? 'active' : '';
                
                // Update FFmpeg status
                document.getElementById('ffmpeg-status').textContent = data.ffmpegStatus === 'configured' ? 
                    '✅ Configured' : '❌ Missing';
                
            } catch (error) {
                console.error('Status update error:', error);
                document.getElementById('status').innerHTML = '<h2>❌ Error connecting to server</h2>';
            }
        }
        
        async function control(action) {
            if (!currentGuildId && action !== 'play') {
                alert('No active music session');
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
            try {
                const response = await fetch('/api/control', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'loop', mode, guildId: currentGuildId || 'global' })
                });

                const data = await response.json();
                if (data.success) {
                    updateStatus();
                }
            } catch (error) {
                console.error('Loop error:', error);
            }
        }

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