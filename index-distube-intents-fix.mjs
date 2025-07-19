import { DisTube } from "distube";
import { Client, IntentsBitField, ActivityType } from "discord.js";
import { SpotifyPlugin } from "@distube/spotify";
import { YtDlpPlugin } from "@distube/yt-dlp";
import express from "express";
import http from "http";
import { WebSocketServer } from "ws";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import fs from "fs";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Define intents as a number (sum of all required intents)
const INTENTS = 33283; // This is the sum of GUILDS (1), GUILD_MESSAGES (512), GUILD_VOICE_STATES (128), MESSAGE_CONTENT (32768)

// Create a new client instance with numeric intents
const client = new Client({
  intents: INTENTS
});

// Global state to track bot status
const globalState = {
  isPlaying: false,
  isPaused: false,
  volume: 50,
  queue: [],
  currentTrack: null,
  loopMode: "off", // off, song, queue
  ffmpegStatus: "unknown",
  voiceConnectionStatus: "disconnected",
  guildId: null,
};

// Check if FFmpeg is installed
async function checkFFmpeg() {
  try {
    const { execSync } = await import("child_process");
    try {
      execSync("ffmpeg -version", { stdio: "ignore" });
      globalState.ffmpegStatus = "configured";
      console.log("FFmpeg is installed and configured.");
    } catch (error) {
      globalState.ffmpegStatus = "missing";
      console.error("FFmpeg is not installed or not in PATH.");
      console.error("Please install FFmpeg to use audio features.");
    }
  } catch (error) {
    console.error("Error checking FFmpeg:", error);
  }
}

// Call the function to check FFmpeg
checkFFmpeg();

// Create a new DisTube instance
const distube = new DisTube(client, {
  leaveOnStop: false,
  leaveOnFinish: false,
  leaveOnEmpty: true,
  emptyCooldown: 300,
  nsfw: false,
  savePreviousSongs: true,
  searchSongs: 0,
  searchCooldown: 60,
  emitNewSongOnly: true,
  emitAddSongWhenCreatingQueue: false,
  emitAddListWhenCreatingQueue: false,
  plugins: [
    new SpotifyPlugin(),
    new YtDlpPlugin(),
  ],
  ytdlOptions: {
    quality: 'highestaudio',
    highWaterMark: 1 << 25,
    filter: 'audioonly',
  },
});

// Set up event listeners for DisTube
distube
  .on("playSong", (queue, song) => {
    globalState.isPlaying = true;
    globalState.isPaused = false;
    globalState.currentTrack = {
      title: song.name,
      url: song.url,
      thumbnail: song.thumbnail,
      duration: song.formattedDuration,
      author: song.uploader.name,
    };
    globalState.queue = queue.songs.slice(1).map(s => ({
      title: s.name,
      url: s.url,
      thumbnail: s.thumbnail,
      duration: s.formattedDuration,
      author: s.uploader.name,
    }));
    globalState.guildId = queue.id;
    globalState.voiceConnectionStatus = "connected";
    
    queue.textChannel.send(
      `🎵 Playing: **${song.name}** - \`${song.formattedDuration}\` - Requested by ${song.user}`
    );
  })
  .on("addSong", (queue, song) => {
    globalState.queue = queue.songs.slice(1).map(s => ({
      title: s.name,
      url: s.url,
      thumbnail: s.thumbnail,
      duration: s.formattedDuration,
      author: s.uploader.name,
    }));
    
    queue.textChannel.send(
      `✅ Added **${song.name}** - \`${song.formattedDuration}\` to the queue by ${song.user}`
    );
  })
  .on("addList", (queue, playlist) => {
    globalState.queue = queue.songs.slice(1).map(s => ({
      title: s.name,
      url: s.url,
      thumbnail: s.thumbnail,
      duration: s.formattedDuration,
      author: s.uploader.name,
    }));
    
    queue.textChannel.send(
      `✅ Added **${playlist.name}** playlist (${playlist.songs.length} songs) to queue`
    );
  })
  .on("error", (channel, error) => {
    if (channel) {
      channel.send(`❌ Error: ${error.message}`);
    }
    console.error("DisTube error:", error);
  })
  .on("finish", queue => {
    globalState.isPlaying = false;
    globalState.currentTrack = null;
    globalState.queue = [];
    
    queue.textChannel.send("🏁 Queue finished!");
  })
  .on("disconnect", queue => {
    globalState.voiceConnectionStatus = "disconnected";
    globalState.isPlaying = false;
    globalState.currentTrack = null;
    globalState.queue = [];
    
    queue.textChannel.send("👋 Disconnected from voice channel");
  })
  .on("empty", queue => {
    queue.textChannel.send("⚠️ Voice channel is empty! Leaving the channel in 5 minutes unless someone joins.");
  })
  .on("initQueue", queue => {
    queue.autoplay = false;
    queue.volume = 50;
    globalState.loopMode = queue.repeatMode === 0 ? "off" : queue.repeatMode === 1 ? "track" : "queue";
  })
  .on("pause", queue => {
    globalState.isPaused = true;
    globalState.isPlaying = false;
    queue.textChannel.send("⏸️ Music paused");
  })
  .on("resume", queue => {
    globalState.isPaused = false;
    globalState.isPlaying = true;
    queue.textChannel.send("▶️ Music resumed");
  })
  .on("noRelated", queue => {
    queue.textChannel.send("❌ Can't find related video to play");
  })
  .on("searchCancel", message => {
    message.channel.send("❌ Searching canceled");
  })
  .on("searchNoResult", message => {
    message.channel.send("❌ No result found!");
  })
  .on("searchResult", (message, results) => {
    message.channel.send(
      `**Choose an option from below**\n${results
        .map((song, i) => `**${i + 1}**. ${song.name} - \`${song.formattedDuration}\``)
        .join("\n")}\n*Enter anything else or wait 60 seconds to cancel*`
    );
  })
  .on("searchDone", () => {})
  .on("searchInvalidAnswer", message => {
    message.channel.send("❌ Invalid number of result");
  })
  .on("searchCancelled", message => {
    message.channel.send("❌ Searching canceled");
  });

// When the client is ready, run this code (only once)
client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}!`);
  
  // Set the bot's activity
  client.user.setPresence({
    activities: [{ name: "!help for commands", type: ActivityType.Listening }],
    status: "online",
  });
});

// Create a message event listener
client.on("messageCreate", async message => {
  // Ignore messages from bots
  if (message.author.bot) return;
  
  // Check if the message starts with the prefix
  const prefix = "!";
  if (!message.content.startsWith(prefix)) return;
  
  // Parse the command and arguments
  const args = message.content.slice(prefix.length).trim().split(/ +/g);
  const command = args.shift().toLowerCase();
  
  // Handle commands
  switch (command) {
    case "play":
    case "p":
      if (!message.member.voice.channel) {
        return message.reply("❌ You need to be in a voice channel to play music!");
      }
      
      if (!args.length) {
        return message.reply("❌ Please provide a song URL or search query!");
      }
      
      message.channel.send(`🔍 Searching for: ${args.join(" ")}`);
      
      try {
        await distube.play(message.member.voice.channel, args.join(" "), {
          member: message.member,
          textChannel: message.channel,
          message,
        });
      } catch (error) {
        console.error("Play error:", error);
        message.reply(`❌ Error: ${error.message}`);
      }
      break;
      
    case "stop":
      if (!message.member.voice.channel) {
        return message.reply("❌ You need to be in a voice channel to stop music!");
      }
      
      const queue = distube.getQueue(message);
      if (!queue) {
        return message.reply("❌ There is nothing playing!");
      }
      
      queue.stop();
      message.channel.send("⏹️ Music stopped!");
      break;
      
    case "skip":
    case "s":
      if (!message.member.voice.channel) {
        return message.reply("❌ You need to be in a voice channel to skip music!");
      }
      
      const skipQueue = distube.getQueue(message);
      if (!skipQueue) {
        return message.reply("❌ There is nothing playing!");
      }
      
      try {
        skipQueue.skip();
        message.channel.send("⏭️ Skipped to the next song!");
      } catch (error) {
        message.reply(`❌ Error: ${error.message}`);
      }
      break;
      
    case "pause":
      if (!message.member.voice.channel) {
        return message.reply("❌ You need to be in a voice channel to pause music!");
      }
      
      const pauseQueue = distube.getQueue(message);
      if (!pauseQueue) {
        return message.reply("❌ There is nothing playing!");
      }
      
      if (pauseQueue.paused) {
        return message.reply("⚠️ The music is already paused!");
      }
      
      pauseQueue.pause();
      message.channel.send("⏸️ Music paused!");
      break;
      
    case "resume":
      if (!message.member.voice.channel) {
        return message.reply("❌ You need to be in a voice channel to resume music!");
      }
      
      const resumeQueue = distube.getQueue(message);
      if (!resumeQueue) {
        return message.reply("❌ There is nothing to resume!");
      }
      
      if (!resumeQueue.paused) {
        return message.reply("⚠️ The music is already playing!");
      }
      
      resumeQueue.resume();
      message.channel.send("▶️ Music resumed!");
      break;
      
    case "queue":
    case "q":
      const queueInfo = distube.getQueue(message);
      if (!queueInfo) {
        return message.reply("❌ There is nothing playing!");
      }
      
      const queueString = queueInfo.songs
        .map(
          (song, i) =>
            `${i === 0 ? "Playing:" : `${i}.`} ${song.name} - \`${song.formattedDuration}\` - Requested by ${song.user}`
        )
        .join("\n");
        
      message.channel.send(`📋 **Current Queue**\n${queueString}`);
      break;
      
    case "loop":
    case "repeat":
      if (!message.member.voice.channel) {
        return message.reply("❌ You need to be in a voice channel to use this command!");
      }
      
      const loopQueue = distube.getQueue(message);
      if (!loopQueue) {
        return message.reply("❌ There is nothing playing!");
      }
      
      let mode = args[0]?.toLowerCase();
      let modeNum;
      
      switch (mode) {
        case "off":
          modeNum = 0;
          break;
        case "song":
        case "track":
        case "s":
        case "t":
          modeNum = 1;
          break;
        case "queue":
        case "q":
          modeNum = 2;
          break;
        default:
          // If no valid mode is provided, cycle through modes
          modeNum = (loopQueue.repeatMode + 1) % 3;
      }
      
      loopQueue.setRepeatMode(modeNum);
      globalState.loopMode = modeNum === 0 ? "off" : modeNum === 1 ? "track" : "queue";
      
      const modeStrings = ["Off", "Song", "Queue"];
      message.channel.send(`🔄 Loop mode set to: **${modeStrings[modeNum]}**`);
      break;
      
    case "volume":
    case "vol":
      if (!message.member.voice.channel) {
        return message.reply("❌ You need to be in a voice channel to change volume!");
      }
      
      const volQueue = distube.getQueue(message);
      if (!volQueue) {
        return message.reply("❌ There is nothing playing!");
      }
      
      const volume = parseInt(args[0]);
      if (isNaN(volume) || volume < 0 || volume > 100) {
        return message.reply("⚠️ Please provide a valid volume level between 0 and 100!");
      }
      
      volQueue.setVolume(volume);
      globalState.volume = volume;
      message.channel.send(`🔊 Volume set to: **${volume}%**`);
      break;
      
    case "nowplaying":
    case "np":
      const npQueue = distube.getQueue(message);
      if (!npQueue) {
        return message.reply("❌ There is nothing playing!");
      }
      
      const song = npQueue.songs[0];
      message.channel.send(
        `🎵 **Now Playing**\n${song.name} - \`${song.formattedDuration}\` - Requested by ${song.user}`
      );
      break;
      
    case "help":
      const helpEmbed = {
        title: "🎵 Music Bot Commands",
        description: "Here are the available commands:",
        fields: [
          {
            name: "!play <song>",
            value: "Play a song from YouTube, Spotify, or a search query",
          },
          {
            name: "!stop",
            value: "Stop playing and clear the queue",
          },
          {
            name: "!skip",
            value: "Skip to the next song",
          },
          {
            name: "!pause",
            value: "Pause the current song",
          },
          {
            name: "!resume",
            value: "Resume the paused song",
          },
          {
            name: "!queue",
            value: "Show the current queue",
          },
          {
            name: "!loop [off/song/queue]",
            value: "Set loop mode (off, song, or queue)",
          },
          {
            name: "!volume <0-100>",
            value: "Set the volume level",
          },
          {
            name: "!nowplaying",
            value: "Show the currently playing song",
          },
        ],
        footer: {
          text: "Music Bot powered by DisTube",
        },
      };
      
      message.channel.send({ embeds: [helpEmbed] });
      break;
      
    default:
      // Unknown command
      break;
  }
});

// Set up Express server for dashboard
const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Serve static files
app.use(express.static(join(__dirname, "public")));

// Serve the dashboard HTML
app.get("/", (req, res) => {
  const dashboardPath = join(__dirname, "public", "dashboard.html");
  
  // Check if dashboard.html exists, if not create it
  if (!fs.existsSync(dashboardPath)) {
    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Music Bot Dashboard</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background-color: #2c2f33;
            color: #ffffff;
        }
        h1, h2, h3 {
            color: #7289da;
        }
        .container {
            background-color: #23272a;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 20px;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
        }
        .controls {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            margin-bottom: 20px;
        }
        button {
            background-color: #7289da;
            color: white;
            border: none;
            padding: 10px 15px;
            border-radius: 4px;
            cursor: pointer;
            transition: background-color 0.3s;
        }
        button:hover {
            background-color: #5b6eae;
        }
        button.active {
            background-color: #43b581;
        }
        .queue-list {
            max-height: 300px;
            overflow-y: auto;
            margin-top: 10px;
        }
        .queue-item {
            display: flex;
            justify-content: space-between;
            padding: 8px;
            border-bottom: 1px solid #40444b;
        }
        .badge {
            display: inline-block;
            padding: 3px 8px;
            border-radius: 12px;
            font-size: 0.8em;
        }
        .badge-success {
            background-color: #43b581;
        }
        .badge-warning {
            background-color: #faa61a;
        }
        .badge-info {
            background-color: #7289da;
        }
        .badge-danger {
            background-color: #f04747;
        }
        .volume-control {
            margin-top: 20px;
        }
        #volume-slider {
            width: 100%;
        }
        .status-bar {
            display: flex;
            justify-content: space-between;
            margin-top: 20px;
            padding: 10px;
            background-color: #40444b;
            border-radius: 4px;
        }
    </style>
</head>
<body>
    <h1>Discord Music Bot Dashboard</h1>
    
    <div class="container">
        <div id="status">
            <h2>🔈 Not Playing</h2>
            <p>Use !play command to play music</p>
        </div>
        
        <div class="controls">
            <button onclick="control('pause')">⏸️ Pause</button>
            <button onclick="control('resume')">▶️ Resume</button>
            <button onclick="control('skip')">⏭️ Skip</button>
            <button onclick="control('stop')">⏹️ Stop</button>
        </div>
        
        <div class="volume-control">
            <h3>🔊 Volume</h3>
            <input type="range" id="volume-slider" min="0" max="100" value="50" oninput="setVolume(this.value)">
            <span id="volume-value">50%</span>
        </div>
        
        <div>
            <h3>🔄 Loop Mode</h3>
            <button id="loop-off" onclick="setLoopMode('off')">Off</button>
            <button id="loop-track" onclick="setLoopMode('track')">Track</button>
            <button id="loop-queue" onclick="setLoopMode('queue')">Queue</button>
        </div>
    </div>
    
    <div class="container">
        <h2>📋 Queue</h2>
        <div id="queue-container">
            <h3>Queue is empty</h3>
        </div>
    </div>
    
    <div class="container">
        <h2>⚙️ System Status</h2>
        <p>FFmpeg: <span id="ffmpeg-status">Checking...</span></p>
        <p>Connection: <span id="connection-status">Disconnected</span></p>
    </div>
    
    <script>
        const ws = new WebSocket("ws://" + window.location.host);
        let currentGuildId = null;
        
        // Connect to WebSocket
        ws.onopen = function() {
            console.log('Connected to server');
            requestStatus();
        };
        
        ws.onmessage = function(event) {
            try {
                const data = JSON.parse(event.data);
                
                // Store the guild ID for controls
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
            if (!currentGuildId) {
                alert('No active music session');
                return;
            }
            
            try {
                const response = await fetch('/control', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        action,
                        guildId: currentGuildId
                    }),
                });
                
                const result = await response.json();
                if (!result.success) {
                    alert("Error: " + result.message);
                }
                
                // Request updated status
                requestStatus();
                
            } catch (error) {
                console.error('Control error:', error);
                alert('Failed to send command to server');
            }
        }
        
        async function setVolume(volume) {
            document.getElementById('volume-value').textContent = volume + "%";
            
            if (!currentGuildId) {
                return;
            }
            
            try {
                const response = await fetch('/volume', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        volume: parseInt(volume),
                        guildId: currentGuildId
                    }),
                });
                
                const result = await response.json();
                if (!result.success) {
                    alert("Error: " + result.message);
                }
                
            } catch (error) {
                console.error('Volume control error:', error);
            }
        }
        
        async function setLoopMode(mode) {
            if (!currentGuildId) {
                alert('No active music session');
                return;
            }
            
            try {
                const response = await fetch('/loop', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        mode,
                        guildId: currentGuildId
                    }),
                });
                
                const result = await response.json();
                if (!result.success) {
                    alert("Error: " + result.message);
                }
                
                // Request updated status
                requestStatus();
                
            } catch (error) {
                console.error('Loop control error:', error);
                alert('Failed to change loop mode');
            }
        }
        
        function requestStatus() {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'getStatus' }));
            }
        }
        
        // Request status update every 5 seconds
        setInterval(requestStatus, 5000);
    </script>
</body>
</html>
    `;
    
    fs.writeFileSync(dashboardPath, htmlContent);
  }
  
  res.sendFile(dashboardPath);
});

// API endpoints for controlling the bot
app.use(express.json());

// Control endpoint (pause, resume, skip, stop)
app.post("/control", (req, res) => {
  const { action, guildId } = req.body;
  
  if (!guildId) {
    return res.json({ success: false, message: "No guild ID provided" });
  }
  
  const queue = distube.getQueue(guildId);
  if (!queue) {
    return res.json({ success: false, message: "No active queue found" });
  }
  
  try {
    switch (action) {
      case "pause":
        if (queue.paused) {
          return res.json({ success: false, message: "Already paused" });
        }
        queue.pause();
        break;
      case "resume":
        if (!queue.paused) {
          return res.json({ success: false, message: "Already playing" });
        }
        queue.resume();
        break;
      case "skip":
        queue.skip();
        break;
      case "stop":
        queue.stop();
        break;
      default:
        return res.json({ success: false, message: "Invalid action" });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error(`Control error (${action}):`, error);
    res.json({ success: false, message: error.message });
  }
});

// Volume control endpoint
app.post("/volume", (req, res) => {
  const { volume, guildId } = req.body;
  
  if (!guildId) {
    return res.json({ success: false, message: "No guild ID provided" });
  }
  
  if (typeof volume !== "number" || volume < 0 || volume > 100) {
    return res.json({ success: false, message: "Invalid volume level" });
  }
  
  const queue = distube.getQueue(guildId);
  if (!queue) {
    globalState.volume = volume; // Still update global state
    return res.json({ success: true });
  }
  
  try {
    queue.setVolume(volume);
    globalState.volume = volume;
    res.json({ success: true });
  } catch (error) {
    console.error("Volume control error:", error);
    res.json({ success: false, message: error.message });
  }
});

// Loop mode control endpoint
app.post("/loop", (req, res) => {
  const { mode, guildId } = req.body;
  
  if (!guildId) {
    return res.json({ success: false, message: "No guild ID provided" });
  }
  
  const queue = distube.getQueue(guildId);
  if (!queue) {
    return res.json({ success: false, message: "No active queue found" });
  }
  
  try {
    let modeNum;
    switch (mode) {
      case "off":
        modeNum = 0;
        break;
      case "track":
      case "song":
        modeNum = 1;
        break;
      case "queue":
        modeNum = 2;
        break;
      default:
        return res.json({ success: false, message: "Invalid loop mode" });
    }
    
    queue.setRepeatMode(modeNum);
    globalState.loopMode = mode;
    res.json({ success: true });
  } catch (error) {
    console.error("Loop control error:", error);
    res.json({ success: false, message: error.message });
  }
});

// WebSocket connection handling
wss.on("connection", (ws) => {
  console.log("Client connected to dashboard");
  
  // Send initial status
  ws.send(JSON.stringify({
    ...globalState,
    timestamp: Date.now(),
  }));
  
  // Handle messages from clients
  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message);
      
      if (data.type === "getStatus") {
        ws.send(JSON.stringify({
          ...globalState,
          timestamp: Date.now(),
        }));
      }
    } catch (error) {
      console.error("WebSocket message error:", error);
    }
  });
  
  ws.on("close", () => {
    console.log("Client disconnected from dashboard");
  });
});

// Broadcast status updates to all connected clients
function broadcastStatus() {
  if (wss.clients.size > 0) {
    const status = {
      ...globalState,
      timestamp: Date.now(),
    };
    
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(status));
      }
    });
  }
}

// Broadcast status every 3 seconds if clients are connected
setInterval(() => {
  if (wss.clients.size > 0) {
    broadcastStatus();
  }
}, 3000);

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Dashboard running on port ${PORT}`);
  console.log(`Visit http://localhost:${PORT} to view the dashboard`);
});

// Login to Discord with your client's token
client.login(process.env.DISCORD_TOKEN);