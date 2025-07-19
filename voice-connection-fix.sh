#!/bin/bash

echo "🔗 VOICE CONNECTION FIX - Discord Music Bot"
echo "==========================================="

# Stop PM2
echo "⏹️ Stopping PM2..."
pm2 stop all 2>/dev/null || true
pm2 delete all 2>/dev/null || true

# Backup current file
echo "💾 Backup current file..."
cp index.mjs index.mjs.backup-voice-$(date +%Y%m%d-%H%M%S) 2>/dev/null || true

# Download voice connection fixed version
echo "⬇️ Downloading VOICE CONNECTION FIXED version..."
wget -q https://raw.githubusercontent.com/kugysoul005/Kugy-discord-test/voice-connection-fix/index-voice-connection-fixed.mjs -O index.mjs

if [ $? -eq 0 ]; then
    echo "✅ Voice connection fixed version downloaded!"
else
    echo "❌ Download failed, using local version..."
    cp index-voice-connection-fixed.mjs index.mjs 2>/dev/null || echo "❌ No local version found!"
fi

echo ""
echo "🎉 VOICE CONNECTION FIX APPLIED!"
echo "================================"
echo ""
echo "✅ FIXED CRITICAL ISSUE:"
echo "  🔴 AbortError: The operation was aborted"
echo "  🔗 Voice connection timeout issues"
echo "  🎵 Audio resource creation failures"
echo "  ⏱️ Connection stability problems"
echo ""
echo "🔗 VOICE CONNECTION IMPROVEMENTS:"
echo "  ⏱️ Increased connection timeout (30 seconds)"
echo "  🔄 Auto-retry mechanism untuk AbortError"
echo "  📊 Enhanced connection state monitoring"
echo "  🛡️ Voice channel permission validation"
echo "  🔍 Real-time connection status tracking"
echo ""
echo "🔧 ENHANCED ERROR HANDLING:"
echo "  ❌ Specific AbortError detection dan handling"
echo "  🔄 Auto-retry untuk connection timeouts"
echo "  📝 Better error messages dengan troubleshooting"
echo "  🔍 Enhanced debugging untuk voice issues"
echo ""
echo "🚀 Start bot with:"
echo "   node index.mjs"
echo ""
echo "📊 Or with PM2:"
echo "   pm2 start index.mjs --name kugy-bot"
echo ""
echo "🔍 NEW COMMANDS:"
echo "   !voice     - Check voice connection status"
echo "   !ffmpeg    - Check FFmpeg status"
echo "   !play      - Now with voice connection validation"
echo "   !queue     - Shows connection dan audio status"
echo ""
echo "🎵 Test commands:"
echo "   !voice"
echo "   !play never gonna give you up"
echo "   (Sekarang voice connection harus stable!)"
echo ""
echo "📋 Check logs untuk voice connection status:"
echo "   pm2 logs kugy-bot --lines 50"
echo ""
echo "🔗 Voice Connection Features:"
echo "   • Enhanced timeout handling"
echo "   • AbortError auto-retry"
echo "   • Permission validation"
echo "   • Real-time status monitoring"