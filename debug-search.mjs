import { Player } from "discord-player";
import { Client, GatewayIntentBits } from "discord.js";

console.log("🔍 Debug Search Issues...");

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates]
});

const player = new Player(client, {
    ytdlOptions: {
        quality: 'highestaudio',
        highWaterMark: 1 << 25
    }
});

// Load extractors
try {
    const { YoutubeiExtractor } = await import('discord-player-youtubei');
    await player.extractors.register(YoutubeiExtractor, {});
    console.log("✅ YouTube Extractor loaded!");
    
    const { DefaultExtractors } = await import('@discord-player/extractor');
    await player.extractors.loadMulti(DefaultExtractors);
    console.log("✅ Default Extractors loaded!");
    
    console.log(`📊 Total extractors: ${player.extractors.store.size}`);
} catch (error) {
    console.error("❌ Error loading extractors:", error.message);
    process.exit(1);
}

// Test different URL formats
const testUrls = [
    "https://youtu.be/fDrTbLXHKu8?si=aGk-B9HdPft1Avjy", // Original URL with si parameter
    "https://youtu.be/fDrTbLXHKu8", // Clean short URL
    "https://www.youtube.com/watch?v=fDrTbLXHKu8", // Full URL
    "fDrTbLXHKu8", // Just video ID
    "never gonna give you up", // Text search
];

for (const testQuery of testUrls) {
    console.log(`\n🔍 Testing: ${testQuery}`);
    
    try {
        // Test with different search engines
        const searchEngines = ["youtube", "auto"];
        
        for (const engine of searchEngines) {
            console.log(`  📡 Search engine: ${engine}`);
            
            const searchResult = await player.search(testQuery, {
                searchEngine: engine
            });
            
            if (searchResult && searchResult.tracks.length > 0) {
                console.log(`  ✅ SUCCESS with ${engine}!`);
                console.log(`  📊 Found ${searchResult.tracks.length} track(s)`);
                console.log(`  🎵 First track: ${searchResult.tracks[0].title} - ${searchResult.tracks[0].author}`);
                console.log(`  🔗 URL: ${searchResult.tracks[0].url}`);
                break; // Stop testing other engines for this URL
            } else {
                console.log(`  ❌ No results with ${engine}`);
            }
        }
    } catch (searchError) {
        console.error(`  ❌ Search error: ${searchError.message}`);
    }
}

process.exit(0);