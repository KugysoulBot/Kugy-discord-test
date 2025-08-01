import { Player } from "discord-player";
import { Client, GatewayIntentBits } from "discord.js";

console.log("🧪 Testing Discord Player Extractor...");

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const player = new Player(client);

try {
    console.log("📦 Importing @discord-player/extractor...");
    const extractorModule = await import('@discord-player/extractor');
    console.log("📋 Available exports:", Object.keys(extractorModule));
    
    // Try different ways to import
    let extractors;
    if (extractorModule.DefaultExtractors) {
        extractors = extractorModule.DefaultExtractors;
        console.log("✅ Using DefaultExtractors");
    } else if (extractorModule.default) {
        extractors = extractorModule.default;
        console.log("✅ Using default export");
    } else {
        console.log("📋 All available extractors:", Object.keys(extractorModule));
        // Try to use all available extractors
        extractors = Object.values(extractorModule).filter(item => 
            typeof item === 'function' || (typeof item === 'object' && item.constructor)
        );
        console.log("✅ Using all available extractors");
    }
    
    console.log("🔄 Loading extractors...");
    if (Array.isArray(extractors)) {
        await player.extractors.loadMulti(extractors);
    } else {
        await player.extractors.loadMulti(extractors);
    }
    
    console.log("✅ Extractors loaded successfully!");
    console.log(`📊 Total extractors loaded: ${player.extractors.store.size}`);
    
    // List loaded extractors
    console.log("📝 Loaded extractors:");
    for (const [name, extractor] of player.extractors.store) {
        console.log(`  - ${name}: ${extractor.constructor.name}`);
    }
    
    // Test search
    console.log("\n🔍 Testing search functionality...");
    const testQuery = "https://youtu.be/fDrTbLXHKu8";
    
    try {
        const searchResult = await player.search(testQuery, {
            searchEngine: "youtube"
        });
        
        if (searchResult && searchResult.tracks.length > 0) {
            console.log("✅ Search berhasil!");
            console.log(`📊 Found ${searchResult.tracks.length} track(s)`);
            console.log(`🎵 First track: ${searchResult.tracks[0].title} - ${searchResult.tracks[0].author}`);
        } else {
            console.log("❌ Search tidak menemukan hasil");
        }
    } catch (searchError) {
        console.error("❌ Search error:", searchError.message);
    }
    
} catch (error) {
    console.error("❌ Error:", error.message);
    console.error("💡 Pastikan @discord-player/extractor terinstall:");
    console.error("   npm install @discord-player/extractor");
}

process.exit(0);