#!/bin/bash

echo "🔧 Fix Bot Discord - Solusi Definitif"
echo "====================================="

# Stop semua proses PM2
echo "⏹️ Menghentikan semua proses PM2..."
pm2 stop all 2>/dev/null || true
pm2 delete all 2>/dev/null || true

# Backup file lama
echo "💾 Backup file lama..."
cp index.mjs index.mjs.backup 2>/dev/null || true
cp Index.mjs Index.mjs.backup 2>/dev/null || true

# Install dependencies yang diperlukan
echo "📦 Installing dependencies..."
npm install @discord-player/extractor --save

# Download file yang sudah diperbaiki
echo "⬇️ Download file yang sudah diperbaiki..."
wget -q https://raw.githubusercontent.com/kugysoul005/Kugy-discord-test/fix-music-bot-persistent-errors/index-fixed.mjs -O index.mjs

if [ $? -eq 0 ]; then
    echo "✅ File berhasil didownload!"
else
    echo "❌ Gagal download file, menggunakan file lokal..."
fi

# Test extractor
echo ""
echo "🧪 Testing extractor..."
node test-extractor.mjs

echo ""
echo "🚀 Bot siap dijalankan!"
echo ""
echo "Pilihan menjalankan bot:"
echo "1. node index.mjs"
echo "2. pm2 start index.mjs --name kugy-bot"
echo ""
echo "💡 Tips:"
echo "- Pastikan MongoDB berjalan"
echo "- Pastikan file .env sudah dikonfigurasi"
echo "- Cek log dengan: pm2 logs kugy-bot"