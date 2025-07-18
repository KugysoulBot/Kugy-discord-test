#!/bin/bash

echo "🔧 Quick Fix untuk Kugy Bot"
echo "=========================="

# Stop PM2 processes jika ada
echo "⏹️ Menghentikan proses PM2..."
pm2 stop kugy-bot 2>/dev/null || true
pm2 delete kugy-bot 2>/dev/null || true

# Install extractor jika belum ada
if [ ! -d "node_modules/@discord-player/extractor" ]; then
    echo "📦 Installing @discord-player/extractor..."
    npm install @discord-player/extractor
    if [ $? -eq 0 ]; then
        echo "✅ Extractor berhasil diinstall!"
    else
        echo "❌ Gagal install extractor!"
        exit 1
    fi
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
    echo "Untuk disable Lavalink (gunakan extractor saja):"
    echo "   Hapus atau comment baris LAVALINK_* di .env"
    echo ""
else
    echo "✅ File .env sudah ada"
fi

# Test extractor
echo ""
echo "🧪 Testing extractor installation..."
node -e "
import('@discord-player/extractor').then(module => {
    console.log('✅ Extractor dapat diimport dengan benar');
    console.log('📦 Available extractors:', Object.keys(module.DefaultExtractors || {}));
}).catch(err => {
    console.error('❌ Error importing extractor:', err.message);
    process.exit(1);
});
" 2>/dev/null

echo ""
echo "🚀 Bot siap dijalankan dengan:"
echo "   node Index.mjs"
echo ""
echo "📊 Atau dengan PM2:"
echo "   pm2 start Index.mjs --name kugy-bot"
echo ""
echo "💡 Tips:"
echo "   - Jika masih error, coba disable Lavalink di .env"
echo "   - Pastikan MongoDB berjalan"
echo "   - Cek log dengan: pm2 logs kugy-bot"