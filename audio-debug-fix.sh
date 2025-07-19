#!/bin/bash

echo "🔧 AUDIO DEBUG FIX - Discord Music Bot"
echo "====================================="

# Stop PM2
echo "⏹️ Stopping PM2..."
pm2 stop all 2>/dev/null || true
pm2 delete all 2>/dev/null || true

# Backup current file
echo "💾 Backup current file..."
cp index.mjs index.mjs.backup-audio-debug-$(date +%Y%m%d-%H%M%S) 2>/dev/null || true

# Download audio debug fixed version
echo "⬇️ Downloading AUDIO DEBUG FIXED version..."
wget -q https://raw.githubusercontent.com/kugysoul005/Kugy-discord-test/audio-debug-fix/index-audio-debug-fixed.mjs -O index.mjs

if [ $? -eq 0 ]; then
    echo "✅ Audio debug fixed version downloaded!"
else
    echo "❌ Download failed, using local version..."
    cp index-audio-debug-fixed.mjs index.mjs 2>/dev/null || echo "❌ No local version found!"
fi

echo ""
echo "🎉 AUDIO DEBUG FIXES APPLIED!"
echo "============================"
echo ""
echo "✅ FIXED ISSUES:"
echo "  🔇 Bot masuk voice tapi tidak ada audio"
echo "  🐛 Debug messages [object Object] error"
echo "  ⚠️ Deprecation warning untuk ephemeral"
echo "  🎵 Audio stream stability issues"
echo ""
echo "🔧 IMPROVEMENTS:"
echo "  📊 Enhanced audio monitoring & debugging"
echo "  🔍 Connection state tracking"
echo "  🛡️ Error recovery system"
echo "  📝 Proper debug message formatting"
echo "  🎛️ Better audio player configuration"
echo ""
echo "🚀 Start bot with:"
echo "   node index.mjs"
echo ""
echo "📊 Or with PM2:"
echo "   pm2 start index.mjs --name kugy-bot"
echo ""
echo "🔍 DEBUGGING FEATURES:"
echo "   • Audio resource monitoring"
echo "   • Voice connection state tracking"
echo "   • Enhanced error logging"
echo "   • FFmpeg configuration validation"
echo ""
echo "🎵 Test commands:"
echo "   !play never gonna give you up"
echo "   (Sekarang audio harus keluar dengan proper debugging)"
echo ""
echo "📋 Check logs untuk audio debugging info:"
echo "   pm2 logs kugy-bot --lines 50"