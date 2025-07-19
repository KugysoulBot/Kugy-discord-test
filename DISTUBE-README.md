# Kugy Bot - DisTube Version

Versi bot Kugy yang menggunakan DisTube sebagai pengganti discord-player untuk pemutaran musik.

## 🚀 Keunggulan DisTube

1. **Lebih Stabil**: Penanganan error yang lebih baik dan lebih sedikit masalah dengan audio resource
2. **Dukungan Platform Luas**: Support untuk YouTube, Spotify, SoundCloud, dan platform lainnya
3. **Konfigurasi Sederhana**: Tidak memerlukan konfigurasi FFmpeg yang kompleks
4. **Performa Lebih Baik**: Lebih ringan dan responsif
5. **Tidak Memerlukan Lavalink**: Bisa berfungsi tanpa server Lavalink terpisah

## 📋 Cara Penggunaan

### Instalasi

```bash
# Install dependensi DisTube
npm install distube @distube/spotify @distube/yt-dlp

# Atau gunakan package.json yang sudah diupdate
npm install
```

### Menjalankan Bot

```bash
# Menggunakan npm script
npm run start:distube

# Atau langsung dengan node
node index-distube-version.mjs

# Dengan PM2
pm2 start index-distube-version.mjs --name "kugy-bot-distube"
```

## 🎵 Fitur Musik

- `!play <url/query>` - Memutar musik dari YouTube, Spotify, SoundCloud, dll
- `!skip` - Skip lagu saat ini
- `!stop` - Stop musik dan keluar dari voice channel
- `!queue` - Tampilkan antrian lagu
- `!loop <off/track/queue>` - Set loop mode

## 🔧 Perbedaan dengan Versi discord-player

1. **Struktur Kode**: Menggunakan DisTube API yang berbeda dari discord-player
2. **Penanganan Error**: Lebih robust dalam menangani error pemutaran
3. **Audio Resource**: Tidak memerlukan konfigurasi audio resource yang kompleks
4. **Loop Mode**: Menggunakan sistem repeatMode (0 = off, 1 = track, 2 = queue)
5. **Dashboard**: Dashboard telah diupdate untuk bekerja dengan DisTube

## 🌐 Dashboard

Dashboard tetap tersedia di http://localhost:3000 (atau port yang dikonfigurasi di .env) dengan tampilan dan fungsionalitas yang sama, tapi menggunakan DisTube di backend.

## 🤖 Fitur Lain

Semua fitur lain tetap dipertahankan:
- Chat AI dengan OpenRouter API
- Sistem leveling dengan MongoDB
- Command !help, !ffmpeg, !audio
- Dan fitur lainnya

## 📝 Catatan

1. Jika mengalami masalah dengan DisTube, pastikan FFmpeg terinstall dengan benar
2. DisTube dan discord-player dapat digunakan secara bergantian dengan menjalankan file yang berbeda
3. Untuk kembali ke versi discord-player, gunakan `npm run start` atau `npm run start:legacy`