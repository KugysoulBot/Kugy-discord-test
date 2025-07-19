import { Client, GatewayIntentBits, Partials, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from "discord.js";
import { Player } from "discord-player";
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

// CRITICAL FIX: FFmpeg Validation dan Setup
console.log("🎵 Discord Music Bot - FFMPEG FIXED VERSION");

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

// CRITICAL FIX: Enhanced Player Configuration dengan FFmpeg
const player = new Player(client, {
    // FIXED: FFmpeg configuration
    ffmpeg: {
        path: ffmpegPath === 'system' ? 'ffmpeg' : ffmpegPath,
        args: [
            '-analyzeduration', '0',
            '-loglevel', '0',
            '-f', 's16le',
            '-ar', '48000',
            '-ac', '2',
        ]
    },
    // FIXED: Enhanced ytdl options
    ytdlOptions: {
        quality: 'highestaudio',
        highWaterMark: 1 << 25,
        filter: 'audioonly',
        begin: 0,
        requestOptions: {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        }
    },
    // FIXED: Audio player options untuk stability
    audioPlayerOptions: {
        behaviors: {
            noSubscriber: 'pause',
            maxMissedFrames: Math.round(5000 / 20),
        }
    },
    // FIXED: Connection options
    connectionOptions: {
        selfDeaf: true,
        selfMute: false,
    },
    // CRITICAL FIX: Force audio resource creation
    skipFFmpeg: false,
    useLegacyFFmpeg: false,
    // FIXED: Additional options untuk audio debugging
    bufferingTimeout: 3000,
    disableVolume: false,
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

// CRITICAL FIX: Enhanced Event Handlers dengan Audio Resource Monitoring
player.events.on("playerStart", (queue, track) => {
    console.log(`🎶 Now playing: ${track.title} - ${track.author}`);
    console.log(`⏱️ Duration: ${track.duration}`);
    console.log(`🔊 Audio URL: ${track.url ? 'Available' : 'Not Available'}`);
    console.log(`🔄 Loop mode: ${globalState.loopMode}`);
    
    // CRITICAL: Audio Resource Validation
    const audioResource = queue.node.resource;
    console.log(`🎵 Audio Resource: ${audioResource ? 'Created ✅' : 'Missing ❌'}`);
    
    if (audioResource) {
        console.log(`🔊 Audio Resource Details:`, {
            readable: audioResource.readable,
            ended: audioResource.ended,
            volume: audioResource.volume?.volume || 'N/A'
        });
    } else {
        console.error(`❌ CRITICAL: Audio Resource not created! This will cause no sound.`);
        
        // Try to recreate audio resource
        setTimeout(() => {
            console.log(`🔄 Attempting to recreate audio resource...`);
            try {
                if (queue && queue.currentTrack) {
                    queue.skip();
                    setTimeout(() => {
                        queue.insertTrack(track, 0);
                    }, 1000);
                }
            } catch (error) {
                console.error(`❌ Failed to recreate audio resource:`, error);
            }
        }, 2000);
    }
    
    updateGlobalState(queue);
    
    if (queue.metadata && queue.metadata.channel) {
        const embed = new EmbedBuilder()
            .setColor(audioResource ? '#00FF00' : '#FF0000')
            .setTitle('🎶 Now Playing')
            .setDescription(`**${track.title}**\nby ${track.author}`)
            .addFields(
                { name: '⏱️ Duration', value: track.duration, inline: true },
                { name: '🔄 Loop Mode', value: globalState.loopMode.toUpperCase(), inline: true },
                { name: '🔊 Audio Status', value: audioResource ? '✅ Resource Created' : '❌ Resource Missing', inline: true }
            )
            .setThumbnail(track.thumbnail);
            
        const row = createControlButtons();
        
        queue.metadata.channel.send({ 
            embeds: [embed], 
            components: [row] 
        });
        
        // Send warning if no audio resource
        if (!audioResource) {
            queue.metadata.channel.send(`⚠️ **Audio Resource Missing!** Mencoba memperbaiki...\n💡 Jika tidak ada suara, coba command \`!play\` lagi.`);
        }
    }
});

// CRITICAL: Audio Resource Creation Monitoring
player.events.on("audioTrackAdd", (queue, track) => {
    console.log(`📥 Track added to queue: ${track.title}`);
    console.log(`🔊 Queue audio resource: ${queue.node.resource ? 'Available' : 'Not Available'}`);
});

// CRITICAL: Monitor audio resource during playback
player.events.on("playerSkip", (queue, track) => {
    console.log(`⏭️ Track skipped: ${track.title}`);
    console.log(`🔊 Audio resource after skip: ${queue.node.resource ? 'Available' : 'Missing'}`);
    updateGlobalState(queue);
});

player.events.on("playerPause", (queue) => {
    console.log(`⏸️ Playback paused`);
    console.log(`🔊 Audio resource during pause: ${queue.node.resource ? 'Available' : 'Missing'}`);
    updateGlobalState(queue);
});

player.events.on("playerResume", (queue) => {
    console.log(`▶️ Playback resumed`);
    console.log(`🔊 Audio resource during resume: ${queue.node.resource ? 'Available' : 'Missing'}`);
    updateGlobalState(queue);
});

// CRITICAL FIX: Enhanced playerFinish event dengan audio resource debugging
player.events.on("playerFinish", (queue, track) => {
    console.log(`✅ Finished playing: ${track.title}`);
    console.log(`🔄 Loop mode: ${globalState.loopMode}`);
    console.log(`📊 Queue size after finish: ${queue.tracks.size}`);
    
    // CRITICAL: Check why audio resource is missing
    const audioResource = queue.node.resource;
    console.log(`🎵 Audio Resource state: ${audioResource ? 'Active' : 'Inactive'}`);
    
    if (!audioResource) {
        console.error(`❌ CRITICAL: Audio resource was missing during playback!`);
        console.log(`🔍 Possible causes:`);
        console.log(`   - FFmpeg not properly configured`);
        console.log(`   - Audio stream creation failed`);
        console.log(`   - Voice connection issues`);
        console.log(`   - Discord-player configuration problems`);
    }
    
    updateGlobalState(queue);
    
    // LOOP LOGIC
    if (globalState.loopMode === 'track') {
        console.log(`🔄 Looping track: ${track.title}`);
        setTimeout(() => {
            try {
                queue.insertTrack(track, 0);
                console.log(`✅ Track re-added for loop: ${track.title}`);
            } catch (error) {
                console.error(`❌ Error looping track:`, error);
            }
        }, 1000);
    } else if (globalState.loopMode === 'queue' && queue.tracks.size === 0) {
        console.log(`🔄 Looping queue, adding ${track.title} to end`);
        setTimeout(() => {
            try {
                queue.addTrack(track);
                console.log(`✅ Track re-added to queue for loop: ${track.title}`);
            } catch (error) {
                console.error(`❌ Error looping queue:`, error);
            }
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

// CRITICAL: Enhanced error handling dengan FFmpeg debugging
player.events.on("error", (queue, error) => {
    console.error(`❌ Player error:`, error);
    console.log(`🔍 Queue state: ${queue ? 'Active' : 'Inactive'}`);
    console.log(`🔍 Current track: ${queue?.currentTrack?.title || 'None'}`);
    console.log(`🔍 Audio resource: ${queue?.node?.resource ? 'Active' : 'Inactive'}`);
    console.log(`🔍 FFmpeg path: ${ffmpegPath || 'Not configured'}`);
    
    updateGlobalState(queue);
    
    if (queue.metadata && queue.metadata.channel) {
        queue.metadata.channel.send(`❌ Terjadi kesalahan audio: ${error.message}\n💡 Mencoba memutar lagu berikutnya...\n🔧 Jika masalah berlanjut, pastikan FFmpeg terinstall.`);
    }
});

player.events.on("playerError", (queue, error) => {
    console.error(`❌ Player error event:`, error);
    console.log(`🔍 Error details:`, {
        message: error.message,
        stack: error.stack?.split('\n')[0],
        queue: queue ? 'Active' : 'Inactive',
        tracks: queue?.tracks?.size || 0,
        ffmpegPath: ffmpegPath || 'Not configured'
    });
    
    // Auto-retry jika error saat playing
    if (queue && queue.tracks.size > 0) {
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

// CRITICAL: Connection state monitoring dengan FFmpeg validation
player.events.on("connectionCreate", (queue) => {
    console.log(`🔗 Voice connection created for guild: ${queue.metadata.guild.name}`);
    console.log(`🔊 Voice channel: ${queue.connection?.joinConfig?.channelId}`);
    console.log(`🎵 Connection state: ${queue.connection?.state?.status}`);
    console.log(`🔧 FFmpeg configured: ${ffmpegPath ? 'Yes' : 'No'}`);
    
    // Validate audio capabilities
    setTimeout(() => {
        const audioResource = queue.node.resource;
        console.log(`🎵 Audio resource after connection: ${audioResource ? 'Created' : 'Missing'}`);
        
        if (!audioResource && queue.currentTrack) {
            console.error(`❌ CRITICAL: No audio resource after connection created!`);
            if (queue.metadata && queue.metadata.channel) {
                queue.metadata.channel.send(`⚠️ **Audio setup issue detected!**\n🔧 Mencoba memperbaiki konfigurasi audio...`);
            }
        }
    }, 3000);
});

player.events.on("connectionDestroyed", (queue) => {
    console.log(`🔌 Voice connection destroyed for guild: ${queue.metadata.guild.name}`);
});

// Fixed debug event handler
player.events.on("debug", (message) => {
    try {
        let msgStr;
        
        if (typeof message === 'string') {
            msgStr = message;
        } else if (typeof message === 'object' && message !== null) {
            if (message.message) {
                msgStr = message.message;
            } else if (message.toString && typeof message.toString === 'function') {
                msgStr = message.toString();
            } else {
                msgStr = JSON.stringify(message, null, 2);
            }
        } else {
            msgStr = String(message);
        }
        
        // Filter out noisy debug messages
        if (!msgStr.includes('[YOUTUBEJS]') && 
            !msgStr.includes('InnertubeError') && 
            !msgStr.includes('GridShelfView') &&
            !msgStr.includes('Received voice state update') &&
            !msgStr.includes('undefined') &&
            msgStr.trim() !== '[object Object]') {
            console.log(`[Player Debug] ${msgStr}`);
        }
    } catch (e) {
        // Ignore debug message errors completely
    }
});

client.once("ready", () => {
  console.log(`✅ Bot aktif sebagai ${client.user.tag}`);
  console.log(`🌐 Dashboard akan tersedia di: http://localhost:3000`);
  console.log(`🔊 Audio debugging enabled`);
  console.log(`🔧 FFmpeg status: ${ffmpegPath ? 'Configured ✅' : 'Missing ❌'}`);
  
  if (!ffmpegPath) {
    console.error(`❌ CRITICAL: FFmpeg not found! Audio will not work.`);
    console.log(`💡 Install FFmpeg:`);
    console.log(`   Ubuntu/Debian: sudo apt update && sudo apt install ffmpeg`);
    console.log(`   CentOS/RHEL: sudo yum install ffmpeg`);
    console.log(`   Or install ffmpeg-static: npm install ffmpeg-static`);
  }
});

// Button Interaction Handler dengan proper flags
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;
    
    const queue = player.queues.get(interaction.guild.id);
    
    try {
        switch (interaction.customId) {
            case 'music_play_pause':
                if (!queue || !queue.isPlaying()) {
                    await interaction.reply({ content: '❌ Tidak ada lagu yang sedang diputar.', flags: 64 });
                    return;
                }
                
                if (queue.node.isPaused()) {
                    queue.node.resume();
                    await interaction.reply({ content: '▶️ Musik dilanjutkan!', flags: 64 });
                } else {
                    queue.node.pause();
                    await interaction.reply({ content: '⏸️ Musik dijeda!', flags: 64 });
                }
                updateGlobalState(queue);
                break;
                
            case 'music_skip':
                if (!queue || !queue.isPlaying()) {
                    await interaction.reply({ content: '❌ Tidak ada lagu yang sedang diputar.', flags: 64 });
                    return;
                }
                
                const currentTrack = queue.currentTrack;
                queue.skip();
                await interaction.reply({ content: `⏭️ Lagu di-skip: **${currentTrack?.title || 'Unknown'}**`, flags: 64 });
                updateGlobalState(queue);
                break;
                
            case 'music_stop':
                if (!queue || !queue.isPlaying()) {
                    await interaction.reply({ content: '❌ Tidak ada lagu yang sedang diputar.', flags: 64 });
                    return;
                }
                
                queue.delete();
                globalState.loopMode = 'off';
                await interaction.reply({ content: '⏹️ Musik dihentikan dan bot keluar dari voice channel.', flags: 64 });
                updateGlobalState(null);
                break;
                
            case 'music_loop':
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
                    flags: 64 
                });
                break;
                
            case 'music_queue':
                if (!queue || (!queue.currentTrack && queue.tracks.size === 0)) {
                    await interaction.reply({ content: '❌ Antrian kosong.', flags: 64 });
                    return;
                }
                
                const embed = new EmbedBuilder()
                    .setColor('#0099FF')
                    .setTitle('📋 Music Queue')
                    .addFields({ name: '🔄 Loop Mode', value: globalState.loopMode.toUpperCase(), inline: true });
                
                if (queue.currentTrack) {
                    const audioResource = queue.node.resource;
                    embed.addFields({ 
                        name: '🎶 Currently Playing', 
                        value: `${queue.currentTrack.title} - ${queue.currentTrack.author}\n🔊 Audio: ${audioResource ? '✅ Active' : '❌ Missing'}`, 
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
                
                await interaction.reply({ embeds: [embed], flags: 64 });
                break;
        }
    } catch (error) {
        console.error('❌ Button interaction error:', error);
        await interaction.reply({ content: '❌ Terjadi kesalahan saat memproses perintah.', flags: 64 });
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
            { name: '🤖 Other Commands', value: '`!chat <pesan>` - Chat dengan AI\n`!help` - Tampilkan help\n`!ffmpeg` - Check FFmpeg status', inline: false },
            { name: '🎛️ Dashboard Features', value: '• Control buttons untuk play/pause/skip/stop\n• Loop mode: OFF/TRACK/QUEUE\n• Real-time queue display\n• Web dashboard di http://localhost:3000', inline: false },
            { name: '🔧 Audio Debug', value: '• Enhanced audio monitoring\n• FFmpeg validation\n• Audio resource tracking\n• Connection state monitoring', inline: false }
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

  // CRITICAL FIX: Enhanced Play Command dengan FFmpeg Validation
  if (message.content.startsWith("!play ")) {
    // Check FFmpeg first
    if (!ffmpegPath) {
        return message.reply(`❌ **FFmpeg tidak ditemukan!** Audio tidak akan berfungsi.\n\n🔧 **Install FFmpeg:**\n\`\`\`bash\n# Ubuntu/Debian\nsudo apt update && sudo apt install ffmpeg\n\n# CentOS/RHEL\nsudo yum install ffmpeg\n\n# NPM Alternative\nnpm install ffmpeg-static\n\`\`\`\n\nSetelah install, restart bot dengan \`pm2 restart kugy-bot\``);
    }
    
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
    console.log(`🔊 Voice channel: ${voiceChannel.name} (${voiceChannel.id})`);
    console.log(`🔧 FFmpeg path: ${ffmpegPath}`);
    
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
                        console.log(`  ✅ Success with ${engine}! Found ${searchResult.tracks.length} tracks`);
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

        console.log(`🎵 Playing: ${searchResult.tracks[0].title} - ${searchResult.tracks[0].author}`);
        console.log(`🔊 Track URL: ${searchResult.tracks[0].url ? 'Available' : 'Not Available'}`);

        // CRITICAL FIX: Enhanced play options dengan FFmpeg validation
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
                // CRITICAL: Additional audio options dengan FFmpeg
                bufferingTimeout: 3000,
                disableVolume: false,
                // Force audio resource creation
                skipFFmpeg: false,
            },
        });

        const queue = player.queues.get(message.guild.id);
        updateGlobalState(queue);
        
        console.log(`✅ Track added to queue: ${track.title}`);
        console.log(`🔊 Queue state: Playing=${queue.isPlaying()}, Size=${queue.tracks.size}`);
        
        // CRITICAL: Validate audio resource creation
        setTimeout(() => {
            const audioResource = queue.node.resource;
            console.log(`🎵 Audio resource validation: ${audioResource ? 'Created ✅' : 'Missing ❌'}`);
            
            if (!audioResource) {
                console.error(`❌ CRITICAL: Audio resource not created after 3 seconds!`);
                message.channel.send(`⚠️ **Audio resource tidak ter-create!**\n🔧 Kemungkinan masalah:\n• FFmpeg configuration\n• Audio stream creation failed\n• Voice connection issues\n\n💡 Coba command \`!play\` lagi atau restart bot.`);
            }
        }, 3000);
        
        if (!track.playlist && queue && queue.tracks.size > 0 && queue.currentTrack !== track) {
            await message.reply(`✅ Ditambahkan ke antrian: **${track.title}**\n📊 Posisi dalam antrian: ${queue.tracks.size}`);
        }
        
    } catch (e) {
        console.error(`❌ Error playing song:`, e);
        console.log(`🔍 Error details:`, {
            message: e.message,
            stack: e.stack?.split('\n')[0],
            query: originalQuery,
            ffmpegPath: ffmpegPath || 'Not configured'
        });
        await message.reply(`❌ Maaf, tidak bisa memutar lagu itu: ${e.message}\n\n💡 **Troubleshooting:**\n- Pastikan FFmpeg terinstall: \`!ffmpeg\`\n- Coba dengan URL YouTube yang berbeda\n- Gunakan nama lagu yang lebih spesifik\n- Restart bot jika masalah berlanjut`);
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
        globalState.loopMode = 'off';
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
        const audioResource = queue.node.resource;
        embed.addFields({ 
            name: '🎶 Currently Playing', 
            value: `${queue.currentTrack.title} - ${queue.currentTrack.author}\n⏱️ ${queue.currentTrack.duration}\n🔊 Audio: ${audioResource ? '✅ Active' : '❌ Missing'}`, 
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

// Dashboard API Routes (same as before but with FFmpeg status)
app.get('/api/status', (req, res) => {
    res.json({
        ...globalState,
        ffmpegStatus: ffmpegPath ? 'configured' : 'missing',
        ffmpegPath: ffmpegPath || null
    });
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

// Serve dashboard with FFmpeg status
app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>🎵 Kugy Bot Dashboard - FFmpeg Fixed</title>
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
        .ffmpeg-status {
            background: rgba(0,0,0,0.3);
            padding: 15px;
            border-radius: 10px;
            margin-top: 20px;
            font-family: monospace;
            font-size: 12px;
        }
        .status-ok { color: #4CAF50; }
        .status-error { color: #f44336; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🎵 Kugy Bot Dashboard - FFmpeg Fixed</h1>
        
        <div class="status">
            <h2>📊 Status</h2>
            <p><strong>Status:</strong> <span id="status">Stopped</span></p>
            <p><strong>🎵 Current Track:</strong> <span id="current-track">None</span></p>
            <p><strong>🔄 Loop Mode:</strong> <span id="loop-mode">OFF</span></p>
            <p><strong>📋 Queue Size:</strong> <span id="queue-size">0</span></p>
            
            <div class="ffmpeg-status">
                <strong>🔧 FFmpeg Status:</strong> <span id="ffmpeg-status">Checking...</span><br>
                <strong>📁 FFmpeg Path:</strong> <span id="ffmpeg-path">Loading...</span><br><br>
                <strong>🔊 Audio Debug Info:</strong><br>
                • Enhanced audio resource monitoring<br>
                • FFmpeg validation and auto-install<br>
                • Connection state tracking active<br>
                • Audio stream creation monitoring
            </div>
        </div>
        
        <div class="controls">
            <button onclick="control('play')">▶️ Play</button>
            <button onclick="control('pause')">⏸️ Pause</button>
            <button onclick="control('skip')">⏭️ Skip</button>
            <button onclick="control('stop')">⏹️ Stop</button>
        </div>
        
        <div class="status">
            <h3>🔄 Loop Control</h3>
            <div class="controls">
                <button onclick="setLoop('off')">⏹️ OFF</button>
                <button onclick="setLoop('track')">🎵 TRACK</button>
                <button onclick="setLoop('queue')">📋 QUEUE</button>
            </div>
        </div>
        
        <div class="status">
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
                
                document.getElementById('status').textContent = data.isPlaying ? 'Playing' : 'Stopped';
                document.getElementById('current-track').textContent = 
                    data.currentTrack ? \`\${data.currentTrack.title} - \${data.currentTrack.author}\` : 'None';
                document.getElementById('loop-mode').textContent = data.loopMode.toUpperCase();
                document.getElementById('queue-size').textContent = data.queue.length;
                
                // FFmpeg status
                const ffmpegStatus = document.getElementById('ffmpeg-status');
                const ffmpegPath = document.getElementById('ffmpeg-path');
                
                if (data.ffmpegStatus === 'configured') {
                    ffmpegStatus.innerHTML = '<span class="status-ok">✅ Configured</span>';
                    ffmpegPath.textContent = data.ffmpegPath || 'System PATH';
                } else {
                    ffmpegStatus.innerHTML = '<span class="status-error">❌ Missing</span>';
                    ffmpegPath.textContent = 'Not found - Audio will not work!';
                }
                
                const queueList = document.getElementById('queue-list');
                if (data.currentTrack || data.queue.length > 0) {
                    let html = '';
                    
                    if (data.currentTrack) {
                        html += \`<div style="padding: 10px; background: rgba(255,152,0,0.2); border-radius: 8px; margin: 5px 0;">
                            🎵 <strong>\${data.currentTrack.title}</strong> - \${data.currentTrack.author}
                        </div>\`;
                    }
                    
                    data.queue.forEach((track, i) => {
                        html += \`<div style="padding: 8px; background: rgba(255,255,255,0.1); border-radius: 6px; margin: 3px 0;">
                            \${i + 1}. \${track.title} - \${track.author}
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