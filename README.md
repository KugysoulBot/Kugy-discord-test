# Kugy Discord Bot

Bot Discord dengan fitur musik menggunakan Node.js dan discord-player v7.

## 🚨 Solusi untuk Error Persisten

### Masalah yang Ditemukan:
1. **Konflik Lavalink + Extractor**: Menggunakan Lavalink server tetapi juga memuat extractor lokal
2. **Missing package.json**: Tidak ada definisi dependencies yang jelas
3. **Cache PM2/Node.js**: File lama masih ter-cache di sistem

### Solusi:

#### Opsi 1: Menggunakan Lavalink (Recommended untuk VPS)
```bash
# 1. Jalankan script pembersihan
./cleanup-and-restart.sh

# 2. Pastikan Lavalink server berjalan
cd /root/lavalink-v4
pm2 start "java -jar Lavalink.jar" --name "lavalink-server"

# 3. Jalankan bot dengan Lavalink
cd /root/kugy-bot
pm2 start Index.mjs --name "kugy-bot"
```

#### Opsi 2: Tanpa Lavalink (Local Extractor)
```bash
# 1. Jalankan script pembersihan
./cleanup-and-restart.sh

# 2. Jalankan bot tanpa Lavalink
pm2 start index-without-lavalink.mjs --name "kugy-bot-local"
```

## 📋 Dependencies

```json
{
  "discord.js": "^14.21.0",
  "discord-player": "^7.1.0",
  "mongoose": "^8.16.3",
  "dotenv": "^16.4.5"
}
```

**PENTING**: Jangan install `@discord-player/extractor` jika menggunakan Lavalink!

## ⚙️ Environment Variables

Copy `.env.example` ke `.env` dan isi dengan nilai yang sesuai:

```bash
cp .env.example .env
nano .env
```

## 🎵 Perbedaan Konfigurasi

### Dengan Lavalink (`Index.mjs`):
- ✅ Performa lebih baik untuk VPS
- ✅ Mendukung lebih banyak sumber audio
- ✅ Lebih stabil untuk server production
- ❌ Memerlukan Lavalink server terpisah

### Tanpa Lavalink (`index-without-lavalink.mjs`):
- ✅ Setup lebih sederhana
- ✅ Tidak perlu server terpisah
- ❌ Performa lebih berat di bot
- ❌ Terbatas pada extractor yang tersedia

## 🔧 Troubleshooting

### Error "extractors.loadDefault() is no longer supported"
- **Penyebab**: Menggunakan method lama dari discord-player v6
- **Solusi**: Gunakan `loadMulti()` atau hapus extractor jika pakai Lavalink

### Error "No results found (Extractor: N/A)"
- **Penyebab**: Konflik antara Lavalink dan extractor lokal
- **Solusi**: Pilih salah satu - Lavalink ATAU extractor lokal

### Error "Cannot find package 'erela.js'"
- **Penyebab**: Cache dari library lama
- **Solusi**: Jalankan script pembersihan dan install fresh

## 📊 Monitoring

```bash
# Lihat status semua proses
pm2 status

# Lihat log bot
pm2 logs kugy-bot --lines 50

# Restart bot
pm2 restart kugy-bot

# Stop bot
pm2 stop kugy-bot
```

## 🎮 Commands

- `!help` - Menampilkan daftar command
- `!play <url/query>` - Memutar musik
- `!skip` - Skip lagu saat ini
- `!stop` - Stop musik dan keluar dari voice channel
- `!queue` - Tampilkan antrian lagu
- `!chat <pesan>` - Chat dengan AI

## 📝 Notes

1. **Jangan** menggunakan extractor lokal jika menggunakan Lavalink
2. **Selalu** jalankan script pembersihan setelah mengubah dependencies
3. **Pastikan** Lavalink server berjalan sebelum menjalankan bot (jika menggunakan Lavalink)
4. **Monitor** log PM2 untuk debugging