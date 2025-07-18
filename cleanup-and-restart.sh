#!/bin/bash

echo "🧹 Memulai pembersihan agresif untuk Kugy Bot..."

# Hentikan semua proses PM2
echo "⏹️ Menghentikan semua proses PM2..."
pm2 stop all
pm2 delete all
pm2 save --force
pm2 kill

# Tunggu beberapa detik untuk memastikan semua proses berhenti
echo "⏳ Menunggu proses berhenti..."
sleep 10

# Bersihkan cache Node.js
echo "🗑️ Membersihkan cache Node.js..."
npm cache clean --force

# Hapus node_modules dan package-lock.json
echo "🗑️ Menghapus node_modules dan package-lock.json..."
rm -rf node_modules
rm -f package-lock.json

# Bersihkan cache PM2
echo "🗑️ Membersihkan cache PM2..."
rm -rf ~/.pm2/logs/*
rm -rf ~/.pm2/pids/*

# Install dependencies fresh
echo "📦 Menginstall dependencies fresh..."
npm install

# Tunggu sebentar sebelum restart
echo "⏳ Menunggu sebelum restart..."
sleep 5

echo "✅ Pembersihan selesai!"
echo ""
echo "🚀 Untuk menjalankan bot:"
echo "   Dengan Lavalink: pm2 start Index.mjs --name 'kugy-bot'"
echo "   Tanpa Lavalink:  pm2 start index-without-lavalink.mjs --name 'kugy-bot-local'"
echo ""
echo "📊 Untuk melihat log: pm2 logs kugy-bot --lines 50"