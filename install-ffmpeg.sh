#!/bin/bash

echo "🎵 Installing FFmpeg for Discord Music Bot"
echo "=========================================="

# Update package list
echo "📦 Updating package list..."
apt update

# Install FFmpeg
echo "⬇️ Installing FFmpeg..."
apt install -y ffmpeg

# Verify installation
echo "✅ Verifying FFmpeg installation..."
ffmpeg -version

if [ $? -eq 0 ]; then
    echo "✅ FFmpeg berhasil diinstall!"
else
    echo "❌ FFmpeg installation failed!"
    exit 1
fi

# Install FFmpeg Node.js packages as backup
echo "📦 Installing FFmpeg Node.js packages..."
npm install ffmpeg-static @ffmpeg-installer/ffmpeg --save

echo ""
echo "🎉 FFmpeg Setup Complete!"
echo "========================"
echo ""
echo "✅ System FFmpeg: Installed"
echo "✅ Node.js FFmpeg packages: Installed"
echo ""
echo "🚀 Bot sekarang siap untuk memutar musik!"
echo ""
echo "Test dengan:"
echo "  ffmpeg -version"
echo "  node index.mjs"