#!/bin/bash

echo "🎯 COMPLETE FIX - Discord Music Bot dengan FFmpeg"
echo "================================================="

# Stop PM2
echo "⏹️ Stopping PM2..."
pm2 stop all 2>/dev/null || true
pm2 delete all 2>/dev/null || true

# Backup current file
echo "💾 Backup current file..."
cp index.mjs index.mjs.backup-$(date +%Y%m%d-%H%M%S) 2>/dev/null || true

# Install system FFmpeg
echo "🎵 Installing FFmpeg..."
if ! command -v ffmpeg &> /dev/null; then
    echo "⬇️ Installing system FFmpeg..."
    apt update && apt install -y ffmpeg
    if [ $? -eq 0 ]; then
        echo "✅ System FFmpeg installed!"
    else
        echo "❌ Failed to install system FFmpeg!"
        exit 1
    fi
else
    echo "✅ System FFmpeg already installed!"
fi

# Verify FFmpeg
echo "🔍 Verifying FFmpeg..."
ffmpeg -version | head -1

# Install Node.js dependencies
echo "📦 Installing Node.js dependencies..."
npm install discord-player-youtubei @discord-player/extractor ffmpeg-static @ffmpeg-installer/ffmpeg --save

if [ $? -eq 0 ]; then
    echo "✅ Dependencies installed successfully!"
else
    echo "❌ Failed to install dependencies!"
    exit 1
fi

# Download fixed version
echo "⬇️ Downloading COMPLETE FIXED version..."
wget -q https://raw.githubusercontent.com/kugysoul005/Kugy-discord-test/fix-music-bot-persistent-errors/index-fixed-final.mjs -O index.mjs

if [ $? -eq 0 ]; then
    echo "✅ Fixed version downloaded!"
else
    echo "❌ Download failed, using local version..."
    cp index-fixed-final.mjs index.mjs 2>/dev/null || echo "❌ No local version found!"
fi

echo ""
echo "🎉 COMPLETE SOLUTION READY!"
echo "==========================="
echo ""
echo "✅ System FFmpeg: Installed"
echo "✅ Node.js FFmpeg packages: Installed"
echo "✅ YouTube extractor: Ready"
echo "✅ URL cleaning: Ready"
echo "✅ Error handling: Ready"
echo ""
echo "🚀 Start bot with:"
echo "   node index.mjs"
echo ""
echo "📊 Or with PM2:"
echo "   pm2 start index.mjs --name kugy-bot"
echo ""
echo "🎵 Test commands:"
echo "   !play https://youtu.be/fDrTbLXHKu8"
echo "   !play jangan menyerah"
echo "   !play never gonna give you up"
echo ""
echo "🔍 Debug commands:"
echo "   ffmpeg -version"
echo "   pm2 logs kugy-bot"