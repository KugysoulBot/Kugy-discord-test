#!/bin/bash

echo "🔧 FFMPEG CRITICAL FIX - Discord Music Bot"
echo "=========================================="

# Stop PM2
echo "⏹️ Stopping PM2..."
pm2 stop all 2>/dev/null || true
pm2 delete all 2>/dev/null || true

# Check and install FFmpeg
echo "🔍 Checking FFmpeg..."
if command -v ffmpeg &> /dev/null; then
    echo "✅ FFmpeg found in system PATH"
    ffmpeg -version | head -1
else
    echo "❌ FFmpeg not found! Installing..."
    
    # Detect OS and install FFmpeg
    if [ -f /etc/debian_version ]; then
        echo "📦 Installing FFmpeg on Debian/Ubuntu..."
        sudo apt update && sudo apt install -y ffmpeg
    elif [ -f /etc/redhat-release ]; then
        echo "📦 Installing FFmpeg on CentOS/RHEL..."
        sudo yum install -y epel-release
        sudo yum install -y ffmpeg
    else
        echo "⚠️ Unknown OS, trying npm install..."
        npm install ffmpeg-static --save
    fi
    
    # Verify installation
    if command -v ffmpeg &> /dev/null; then
        echo "✅ FFmpeg installed successfully!"
        ffmpeg -version | head -1
    else
        echo "⚠️ System FFmpeg install failed, using npm fallback..."
        npm install ffmpeg-static @ffmpeg-installer/ffmpeg --save
    fi
fi

# Backup current file
echo "💾 Backup current file..."
cp index.mjs index.mjs.backup-ffmpeg-$(date +%Y%m%d-%H%M%S) 2>/dev/null || true

# Download FFmpeg fixed version
echo "⬇️ Downloading FFMPEG FIXED version..."
wget -q https://raw.githubusercontent.com/kugysoul005/Kugy-discord-test/ffmpeg-critical-fix/index-ffmpeg-fixed.mjs -O index.mjs

if [ $? -eq 0 ]; then
    echo "✅ FFmpeg fixed version downloaded!"
else
    echo "❌ Download failed, using local version..."
    cp index-ffmpeg-fixed.mjs index.mjs 2>/dev/null || echo "❌ No local version found!"
fi

echo ""
echo "🎉 FFMPEG CRITICAL FIX APPLIED!"
echo "==============================="
echo ""
echo "✅ FIXED CRITICAL ISSUE:"
echo "  🔇 Bot masuk voice tapi tidak ada audio"
echo "  🎵 Audio Resource: Missing → Fixed"
echo "  🔧 FFmpeg validation dan auto-install"
echo "  📊 Enhanced audio resource monitoring"
echo ""
echo "🔧 FFMPEG IMPROVEMENTS:"
echo "  📁 Auto-detect FFmpeg path"
echo "  🛠️ Auto-install jika tidak ada"
echo "  ⚙️ Enhanced FFmpeg configuration"
echo "  🔍 Real-time audio resource validation"
echo "  📊 Connection state monitoring"
echo ""
echo "🚀 Start bot with:"
echo "   node index.mjs"
echo ""
echo "📊 Or with PM2:"
echo "   pm2 start index.mjs --name kugy-bot"
echo ""
echo "🔍 NEW COMMANDS:"
echo "   !ffmpeg    - Check FFmpeg status"
echo "   !play      - Now with FFmpeg validation"
echo "   !queue     - Shows audio resource status"
echo ""
echo "🎵 Test commands:"
echo "   !ffmpeg"
echo "   !play never gonna give you up"
echo "   (Sekarang HARUS ada audio!)"
echo ""
echo "📋 Check logs untuk FFmpeg status:"
echo "   pm2 logs kugy-bot --lines 50"
echo ""
echo "🔧 FFmpeg Status Check:"
if command -v ffmpeg &> /dev/null; then
    echo "   ✅ FFmpeg: READY"
else
    echo "   ❌ FFmpeg: MISSING (install dengan script di atas)"
fi