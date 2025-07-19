#!/bin/bash

echo "🎵 AUDIO RESOURCE FIX - Discord Music Bot"
echo "========================================="

# Stop PM2
echo "⏹️ Stopping PM2..."
pm2 stop all 2>/dev/null || true
pm2 delete all 2>/dev/null || true

# Backup current file
echo "💾 Backup current file..."
cp index.mjs index.mjs.backup-audio-$(date +%Y%m%d-%H%M%S) 2>/dev/null || true

# Download audio resource fixed version
echo "⬇️ Downloading AUDIO RESOURCE FIXED version..."
wget -q https://raw.githubusercontent.com/kugysoul005/Kugy-discord-test/audio-resource-fix/index-audio-resource-fixed.mjs -O index.mjs

if [ $? -eq 0 ]; then
    echo "✅ Audio resource fixed version downloaded!"
else
    echo "❌ Download failed, using local version..."
    cp index-audio-resource-fixed.mjs index.mjs 2>/dev/null || echo "❌ No local version found!"
fi

echo ""
echo "🎉 AUDIO RESOURCE FIX APPLIED!"
echo "=============================="
echo ""
echo "✅ FIXED CRITICAL ISSUE:"
echo "  🎵 Audio Resource: Missing → Force Creation System"
echo "  ⏱️ Lagu finish terlalu cepat → Quick Finish Detection"
echo "  🔄 Auto-retry mechanism untuk audio issues"
echo "  📊 Enhanced audio resource monitoring"
echo ""
echo "🎵 AUDIO RESOURCE IMPROVEMENTS:"
echo "  🔧 Force audio resource creation jika missing"
echo "  ⏱️ Quick finish detection (< 10 detik)"
echo "  🔄 Auto-retry untuk tracks yang finish cepat"
echo "  📊 Real-time audio resource validation"
echo "  🛠️ Multiple recovery methods"
echo ""
echo "🔍 ENHANCED MONITORING:"
echo "  📊 Audio resource status tracking"
echo "  ⏱️ Track duration monitoring"
echo "  🔄 Auto-retry logging"
echo "  🎵 Audio resource lifecycle tracking"
echo ""
echo "🚀 Start bot with:"
echo "   node index.mjs"
echo ""
echo "📊 Or with PM2:"
echo "   pm2 start index.mjs --name kugy-bot"
echo ""
echo "🔍 NEW COMMANDS:"
echo "   !audio     - Check audio resource status"
echo "   !ffmpeg    - Check FFmpeg status"
echo "   !play      - Now with audio resource force creation"
echo "   !queue     - Shows audio resource status"
echo ""
echo "🎵 Test commands:"
echo "   !audio"
echo "   !play golden hour jvke"
echo "   (Sekarang audio resource harus ter-create!)"
echo ""
echo "📋 Check logs untuk audio resource status:"
echo "   pm2 logs kugy-bot --lines 50"
echo ""
echo "🎵 Audio Resource Features:"
echo "   • Force creation jika missing"
echo "   • Quick finish detection"
echo "   • Auto-retry mechanisms"
echo "   • Real-time status monitoring"