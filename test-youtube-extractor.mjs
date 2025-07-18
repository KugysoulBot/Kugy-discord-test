import { Player } from "discord-player";
import { Client, GatewayIntentBits } from "discord.js";

console.log("🧪 Testing YouTube Extractor...");

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates]
});

const player = new Player(client, {
    ytdlOptions: {
        quality: 'highestaudio',
        highWaterMark: 1 << 25
    }
});

try {
    // Try discord-player-youtubei
    console.log("📦 Trying discord-player-youtubei...");
    const { YoutubeiExtractor } = await import('discord-player-youtubei');
    await player.extractors.register(YoutubeiExtractor, {});
    console.log("✅ YoutubeiExtractor registered!");
} catch (error) {
    console.log("❌ YoutubeiExtractor failed:", error.message);
}

try {
    // Also load default extractors
    console.log("📦 Loading default extractors...");
    const { DefaultExtractors } = await import('@discord-player/extractor');
    await player.extractors.loadMulti(DefaultExtractors);
    console.log("✅ Default extractors loaded!");
} catch (error) {
    console.log("❌ Default extractors failed:", error.message);
}

console.log(`📊 Total extractors loaded: ${player.extractors.store.size}`);

// List loaded extractors
console.log("📝 Loaded extractors:");
for (const [name, extractor] of player.extractors.store) {
    console.log(`  - ${name}: ${extractor.constructor.name}`);
}

// Test search
console.log("\n🔍 Testing YouTube URL...");
const testQuery = "https://youtu.be/fDrTbLXHKu8";

try {
    const searchResult = await player.search(testQuery, {
        searchEngine: "youtube"
    });
    
    if (searchResult && searchResult.tracks.length > 0) {
        console.log("✅ YouTube search berhasil!");
        console.log(`📊 Found ${searchResult.tracks.length} track(s)`);
        console.log(`🎵 First track: ${searchResult.tracks[0].title} - ${searchResult.tracks[0].author}`);
        console.log(`🔗 URL: ${searchResult.tracks[0].url}`);
    } else {
        console.log("❌ YouTube search tidak menemukan hasil");
    }
} catch (searchError) {
    console.error("❌ YouTube search error:", searchError.message);
}

// Test text search
console.log("\n🔍 Testing text search...");
try {
    const searchResult2 = await player.search("never gonna give you up", {
        searchEngine: "youtube"
    });
    
    if (searchResult2 && searchResult2.tracks.length > 0) {
        console.log("✅ Text search berhasil!");
        console.log(`📊 Found ${searchResult2.tracks.length} track(s)`);
        console.log(`🎵 First track: ${searchResult2.tracks[0].title} - ${searchResult2.tracks[0].author}`);
    } else {
        console.log("❌ Text search tidak menemukan hasil");
    }
} catch (searchError) {
    console.error("❌ Text search error:", searchError.message);
}

process.exit(0);