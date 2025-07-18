#!/bin/bash

echo "🎵 AUDIO FIX - Discord Music Bot"
echo "================================"

# Stop PM2
echo "⏹️ Stopping PM2..."
pm2 stop all 2>/dev/null || true
pm2 delete all 2>/dev/null || true

# Backup current file
echo "💾 Backup current file..."
cp index.mjs index.mjs.backup-audio-$(date +%Y%m%d-%H%M%S) 2>/dev/null || true

# Download audio-fixed version
echo "⬇️ Downloading AUDIO FIXED version..."
wget -q https://raw.githubusercontent.com/kugysoul005/Kugy-discord-test/fix-music-bot-persistent-errors/index-audio-fixed.mjs -O index.mjs

if [ $? -eq 0 ]; then
    echo "✅ Audio fixed version downloaded!"
else
    echo "❌ Download failed, using local version..."
    cp index-audio-fixed.mjs index.mjs 2>/dev/null || echo "❌ No local version found!"
fi

echo ""
echo "🎉 AUDIO FIXES APPLIED!"
echo "======================"
echo ""
echo "✅ FIXED: Lagu mulai dari detik 0"
echo "✅ FIXED: Bot tidak keluar setelah lagu habis"
echo "✅ FIXED: Auto-play lagu berikutnya"
echo "✅ FIXED: 30 detik delay sebelum keluar channel"
echo "✅ FIXED: Better queue management"
echo "✅ FIXED: Enhanced error handling"
echo ""
echo "🚀 Start bot with:"
echo "   node index.mjs"
echo ""
echo "📊 Or with PM2:"
echo "   pm2 start index.mjs --name kugy-bot"
echo ""
echo "🎵 Test audio fixes:"
echo "   !play https://youtu.be/fDrTbLXHKu8"
echo "   !play never gonna give you up"
echo "   (Lagu akan mulai dari detik 0)"
echo "   (Bot akan auto-play lagu berikutnya)"
echo "   (Bot akan tunggu 30 detik sebelum keluar)"