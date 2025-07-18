#!/bin/bash

echo "🚀 Kugy Bot Deployment Script"
echo "=============================="

# Fungsi untuk menampilkan menu
show_menu() {
    echo ""
    echo "Pilih mode deployment:"
    echo "1) Dengan Lavalink (Recommended untuk VPS)"
    echo "2) Tanpa Lavalink (Local Extractor)"
    echo "3) Pembersihan cache saja"
    echo "4) Exit"
    echo ""
}

# Fungsi pembersihan
cleanup() {
    echo "🧹 Memulai pembersihan..."
    
    # Hentikan semua proses PM2
    pm2 stop all 2>/dev/null
    pm2 delete all 2>/dev/null
    pm2 save --force 2>/dev/null
    pm2 kill 2>/dev/null
    
    # Tunggu proses berhenti
    sleep 5
    
    # Bersihkan cache dan dependencies
    npm cache clean --force 2>/dev/null
    rm -rf node_modules
    rm -f package-lock.json
    
    # Bersihkan cache PM2
    rm -rf ~/.pm2/logs/* 2>/dev/null
    rm -rf ~/.pm2/pids/* 2>/dev/null
    
    echo "✅ Pembersihan selesai!"
}

# Fungsi install dependencies
install_deps() {
    echo "📦 Menginstall dependencies..."
    npm install
    if [ $? -eq 0 ]; then
        echo "✅ Dependencies berhasil diinstall!"
    else
        echo "❌ Gagal menginstall dependencies!"
        exit 1
    fi
}

# Fungsi deploy dengan Lavalink
deploy_with_lavalink() {
    echo "🎵 Deploying dengan Lavalink..."
    
    # Cek apakah Lavalink server berjalan
    if ! pm2 list | grep -q "lavalink-server.*online"; then
        echo "⚠️ Lavalink server tidak berjalan!"
        echo "Silakan jalankan Lavalink server terlebih dahulu:"
        echo "cd /root/lavalink-v4 && pm2 start 'java -jar Lavalink.jar' --name 'lavalink-server'"
        read -p "Tekan Enter setelah Lavalink server berjalan..."
    fi
    
    # Jalankan bot
    pm2 start Index.mjs --name "kugy-bot"
    
    if [ $? -eq 0 ]; then
        echo "✅ Bot berhasil dijalankan dengan Lavalink!"
        echo "📊 Gunakan 'pm2 logs kugy-bot' untuk melihat log"
    else
        echo "❌ Gagal menjalankan bot!"
    fi
}

# Fungsi deploy tanpa Lavalink
deploy_without_lavalink() {
    echo "🎵 Deploying tanpa Lavalink (Local Extractor)..."
    
    # Pastikan extractor terinstall
    if [ ! -d "node_modules/@discord-player/extractor" ]; then
        echo "📦 Installing extractor..."
        npm install @discord-player/extractor
    fi
    
    # Jalankan bot
    pm2 start index-without-lavalink.mjs --name "kugy-bot-local"
    
    if [ $? -eq 0 ]; then
        echo "✅ Bot berhasil dijalankan tanpa Lavalink!"
        echo "📊 Gunakan 'pm2 logs kugy-bot-local' untuk melihat log"
    else
        echo "❌ Gagal menjalankan bot!"
    fi
}

# Main script
while true; do
    show_menu
    read -p "Masukkan pilihan (1-4): " choice
    
    case $choice in
        1)
            cleanup
            install_deps
            deploy_with_lavalink
            break
            ;;
        2)
            cleanup
            install_deps
            deploy_without_lavalink
            break
            ;;
        3)
            cleanup
            echo "✅ Pembersihan selesai! Jalankan script lagi untuk deployment."
            break
            ;;
        4)
            echo "👋 Goodbye!"
            exit 0
            ;;
        *)
            echo "❌ Pilihan tidak valid! Silakan pilih 1-4."
            ;;
    esac
done

echo ""
echo "🎉 Deployment selesai!"
echo ""
echo "📋 Useful commands:"
echo "   pm2 status          - Lihat status semua proses"
echo "   pm2 logs <name>     - Lihat log bot"
echo "   pm2 restart <name>  - Restart bot"
echo "   pm2 stop <name>     - Stop bot"