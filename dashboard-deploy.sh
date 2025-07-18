#!/bin/bash

echo "🎛️ DASHBOARD DEPLOY - Discord Music Bot with Controls"
echo "===================================================="

# Stop PM2
echo "⏹️ Stopping PM2..."
pm2 stop all 2>/dev/null || true
pm2 delete all 2>/dev/null || true

# Backup current file
echo "💾 Backup current file..."
cp index.mjs index.mjs.backup-dashboard-$(date +%Y%m%d-%H%M%S) 2>/dev/null || true

# Install dashboard dependencies
echo "📦 Installing dashboard dependencies..."
npm install express cors --save

# Download dashboard version
echo "⬇️ Downloading DASHBOARD version..."
wget -q https://raw.githubusercontent.com/kugysoul005/Kugy-discord-test/fix-music-bot-persistent-errors/index-with-dashboard.mjs -O index.mjs

if [ $? -eq 0 ]; then
    echo "✅ Dashboard version downloaded!"
else
    echo "❌ Download failed, using local version..."
    cp index-with-dashboard.mjs index.mjs 2>/dev/null || echo "❌ No local version found!"
fi

echo ""
echo "🎉 DASHBOARD READY!"
echo "=================="
echo ""
echo "✅ FEATURES:"
echo "  🎛️ Discord Control Buttons (Play/Pause/Skip/Stop/Loop)"
echo "  🔄 Loop Modes: OFF/TRACK/QUEUE"
echo "  🌐 Web Dashboard: http://localhost:3000"
echo "  📊 Real-time Status Updates"
echo "  📋 Live Queue Display"
echo ""
echo "🚀 Start bot with:"
echo "   node index.mjs"
echo ""
echo "📊 Or with PM2:"
echo "   pm2 start index.mjs --name kugy-bot"
echo ""
echo "🎵 Test commands:"
echo "   !play never gonna give you up"
echo "   (Control buttons akan muncul otomatis)"
echo "   !loop track    (untuk loop lagu saat ini)"
echo "   !loop queue    (untuk loop seluruh antrian)"
echo "   !loop off      (untuk matikan loop)"
echo ""
echo "🌐 Dashboard:"
echo "   Buka: http://localhost:3000"
echo "   Features: Play/Pause/Skip/Stop/Loop controls"
echo ""
echo "🎛️ Discord Controls:"
echo "   ▶️ Play/Pause - Toggle playback"
echo "   ⏭️ Skip - Skip current track"
echo "   ⏹️ Stop - Stop and leave channel"
echo "   🔄 Loop - Cycle: OFF → TRACK → QUEUE → OFF"
echo "   📋 Queue - Show current queue"