import { Player } from "discord-player";
import { Client, GatewayIntentBits } from "discord.js";

console.log("🧪 Testing Discord Player Built-in YouTube Support...");

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates]
});

// Test tanpa extractor sama sekali
const player = new Player(client, {
    ytdlOptions: {
        quality: 'highestaudio',
        highWaterMark: 1 << 25
    }
});

console.log(`📊 Extractors loaded: ${player.extractors.store.size}`);

// Test search tanpa extractor
console.log("\n🔍 Testing search tanpa extractor...");
const testQuery = "https://youtu.be/fDrTbLXHKu8";

try {
    const searchResult = await player.search(testQuery, {
        searchEngine: "youtube"
    });
    
    if (searchResult && searchResult.tracks.length > 0) {
        console.log("✅ Search berhasil dengan built-in YouTube!");
        console.log(`📊 Found ${searchResult.tracks.length} track(s)`);
        console.log(`🎵 First track: ${searchResult.tracks[0].title} - ${searchResult.tracks[0].author}`);
    } else {
        console.log("❌ Search tidak menemukan hasil");
    }
} catch (searchError) {
    console.error("❌ Search error:", searchError.message);
    console.error("Stack:", searchError.stack);
}

// Test dengan query text
console.log("\n🔍 Testing search dengan text query...");
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