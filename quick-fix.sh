#!/bin/bash

echo "🔧 Quick Fix untuk Kugy Bot"
echo "=========================="

# Install extractor jika belum ada
if [ ! -d "node_modules/@discord-player/extractor" ]; then
    echo "📦 Installing @discord-player/extractor..."
    npm install @discord-player/extractor
    echo "✅ Extractor berhasil diinstall!"
else
    echo "✅ Extractor sudah terinstall"
fi

# Cek apakah .env ada
if [ ! -f ".env" ]; then
    echo "⚠️ File .env tidak ditemukan!"
    echo "📝 Membuat .env dari template..."
    cp .env.example .env
    echo ""
    echo "🔑 PENTING: Edit file .env dan isi dengan token Discord Anda:"
    echo "   nano .env"
    echo ""
    echo "Minimal yang harus diisi:"
    echo "   DISCORD_TOKEN=your_discord_bot_token"
    echo "   MONGO_URI=mongodb://localhost:27017/kugy-bot"
    echo ""
else
    echo "✅ File .env sudah ada"
fi

echo ""
echo "🚀 Bot siap dijalankan dengan:"
echo "   node Index.mjs"
echo ""
echo "📊 Atau dengan PM2:"
echo "   pm2 start Index.mjs --name kugy-bot"