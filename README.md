# BuzzTrack - Pemindai Disinformasi Multi-Platform

## 📋 Tentang Proyek

BuzzTrack (juga dikenal sebagai EchoWatch) adalah aplikasi web full-stack untuk mendeteksi, memantau, dan menganalisis jaringan buzzer, akun terkoordinasi, dan kampanye disinformasi di platform media sosial utama seperti Twitter/X, YouTube, dan TikTok.

Aplikasi ini menggunakan kombinasi scraping otomatis, analisis AI (menggunakan Google Gemini API dan OpenRouter), serta visualisasi jaringan interaktif untuk membantu Anda mengidentifikasi dan memahami pola disinformasi.

## 🛠️ Fitur Utama

1. **Intel Kampanye** - Memantau dan menganalisis kampanye disinformasi yang sedang berjalan
2. **Profil Entitas** - Analisis mendalam terhadap akun mencurigakan dan skor bot
3. **Matriks Jaringan** - Visualisasi graf interaktif hubungan antara akun dan kampanye dengan fitur zoom dan pan
4. **Analitik Sosial** - Dashboard statistik dan demografi lengkap
5. **Tren Harian** - Analisis tren harian dengan insight AI (fallback ke heuristic jika token AI habis)
6. **Analis Ancaman** - Analisis konten berpotensi bahaya menggunakan AI
7. **Lapor Insiden** - Form untuk melaporkan insiden disinformasi
8. **Pencarian Kata Kunci OSINT** - Memindai jaringan berdasarkan kata kunci tertentu
9. **Pencarian Trending Otomatis** - Auto-scrape konten trending dari Twitter/X, YouTube, dan TikTok untuk Tren Harian

## 📂 Struktur Proyek

```
buzztrack/
├── data/                      # Data penyimpanan lokal
│   ├── accounts.json
│   ├── campaigns.json
│   └── gemini-key.json
├── scrapers/                  # Script scraping media sosial
│   ├── __pycache__/
│   ├── requirements.txt       # Dependencies Python untuk scraper
│   ├── run_scraper.py         # Runner untuk semua scraper
│   ├── tiktok_scraper.py      # Scraper TikTok
│   ├── twitter_scraper.py     # Scraper Twitter/X
│   └── youtube_scraper.py     # Scraper YouTube
├── src/                       # Kode frontend (React + TypeScript + Vite)
│   ├── components/            # Komponen UI
│   │   ├── CampaignDetails.tsx
│   │   ├── DatePickerModal.tsx
│   │   ├── NetworkGraph.tsx
│   │   ├── SocialAnalyticsDashboard.tsx
│   │   └── TrendDashboard.tsx
│   ├── core/                  # Logika bisnis inti (Clean Architecture)
│   │   ├── domain/
│   │   │   ├── entities/      # Definisi tipe dan model data
│   │   │   └── repositories/  # Interface repository
│   │   └── use-cases/         # Use case aplikasi
│   ├── infrastructure/        # Implementasi infrastruktur
│   │   ├── repositories/      # Implementasi repository
│   │   └── services/          # Layanan eksternal (AI Service)
│   ├── settings/              # Komponen pengaturan
│   ├── utils/                 # Utilitas umum
│   ├── App.tsx                # Komponen utama aplikasi
│   ├── api.ts                 # API client
│   └── ...
├── .env.example               # Contoh file konfigurasi environment
├── .gitignore
├── index.html                 # Entry point HTML
├── package.json               # Dependencies dan script NPM
├── server.ts                  # Backend Express.js
├── tsconfig.json
└── vite.config.ts
```

## 🔧 Instalasi dan Pengaturan

### Prasyarat

Pastikan Anda sudah menginstal:

- **Node.js** (versi 18 atau lebih baru)
- **Python** (versi 3.8 atau lebih baru) - untuk fitur scraper
- **NPM** atau **Yarn** - package manager

### Langkah-Langkah Instalasi

1. **Clone repository (jika belum):**
   ```bash
   git clone https://github.com/yuurhakids-blip/buzztrack.git
   cd buzztrack
   ```

2. **Install dependencies Node.js:**
   ```bash
   npm install
   ```

3. **Install dependencies Python (untuk scraper):**
   ```bash
   cd scrapers
   pip install -r requirements.txt
   cd ..
   ```

4. **Konfigurasi Environment:**
   Salin file `.env.example` menjadi `.env`:
   ```bash
   cp .env.example .env
   # atau di Windows:
   copy .env.example .env
   ```

   Edit file `.env` dengan credential Anda:
   ```env
   # Twitter/X
   TWITTER_COOKIES="auth_token=YOUR_AUTH_TOKEN; ct0=YOUR_CT0"
   
   # YouTube (jika perlu)
   YOUTUBE_API_KEY="YOUR_YOUTUBE_API_KEY"
   
   # TikTok
   TIKTOK_MS_TOKEN="YOUR_TIKTOK_MS_TOKEN"
   
   # Opsional: Nonaktifkan Python scraper
   # DISABLE_PYTHON_SCRAPERS=true
   ```

   **Catatan:**
   - `TWITTER_COOKIES`: Ambil `auth_token` dan `ct0` dari cookies di browser setelah login ke X/Twitter
   - `TIKTOK_MS_TOKEN`: Ambil dari cookies di TikTok
   - Jika Anda tidak ingin mengkonfigurasi scraper, aplikasi akan menggunakan data sintetis sebagai fallback

## 🚀 Menjalankan Aplikasi

### Mode Pengembangan (Development)

Jalankan frontend dan backend secara bersamaan dengan satu perintah:

```bash
npm run dev
```

Perintah ini akan menjalankan:
- Backend API server di `http://localhost:3001`
- Frontend Vite dev server di `http://localhost:3000`

### Mode Produksi (Production)

Untuk build aplikasi dan menjalankannya di mode produksi:

1. **Build frontend:**
   ```bash
   npm run build
   ```

2. **Jalankan server produksi:**
   ```bash
   npm start
   ```

## 📖 Cara Penggunaan

### 1. Pengaturan API Key AI

Untuk menggunakan fitur analisis AI, Anda perlu mengatur API key:
1. Klik menu **Pengaturan** di sidebar
2. Pilih **Provider** (Gemini atau OpenRouter)
3. Masukkan **API Key** Anda
4. (Opsional) Pilih **Model** yang ingin digunakan
5. Simpan pengaturan

### 2. Menggunakan Pencarian Kata Kunci OSINT

1. Masukkan kata kunci di kolom **"Pencarian Kata Kunci OSINT"**
2. Klik **"Mulai Pindai"**
3. Tunggu sampai proses selesai
4. Hasil pencarian akan muncul di tab **Intel Kampanye** dan **Profil Entitas**

### 3. Menggunakan Tren Harian

1. Buka tab **Tren Harian**
2. Aplikasi akan otomatis mencari konten trending dari Twitter/X, YouTube, dan TikTok
3. Lihat insight tren yang dihasilkan (AI atau heuristic)

### 4. Menjelajahi Matriks Jaringan

1. Buka tab **Matriks Jaringan**
2. Gunakan fitur:
   - **Zoom in/out**: Scroll mouse ke atas/bawah
   - **Pan/scroll**: Klik dan drag area kosong
   - **Filter platform**: Klik tombol filter di pojok kanan atas
   - **AI Clustering**: Klik tombol "AI CLUSTER GRAPH" untuk analisis klaster AI
   - **Pilih node**: Klik node untuk melihat detail di panel kanan

## 🔌 API Endpoint

Backend menyediakan beberapa endpoint API utama:

### Scraping dan Data
- `POST /api/social/search`: Pencarian berdasarkan kata kunci
- `POST /api/social/scrape-trending`: Scraping konten trending
- `GET /api/trend/daily`: Mendapatkan data tren harian
- `GET /api/campaigns`: Mendapatkan daftar kampanye
- `GET /api/accounts`: Mendapatkan daftar akun

### AI
- `POST /api/proxy/gemini/generate`: Proxy untuk Gemini API

## 📦 Dependencies Utama

### Frontend
- **React 19** - Library UI
- **TypeScript** - Type safety
- **Vite** - Build tool dan dev server
- **Tailwind CSS** - Utility-first CSS framework
- **Lucide React** - Ikon
- **Recharts** - Visualisasi chart

### Backend
- **Express.js** - Web framework
- **TypeScript** - Type safety
- **tsx** - TypeScript executor

### Scraper
- **yt-dlp** - YouTube downloader dan scraper
- **TikTokApi** - TikTok scraper
- **twitter-cli** - Twitter/X scraper (opsional)

## 📝 Catatan Penting

1. **Rate Limit**: Pastikan Anda memperhatikan rate limit API dan platform media sosial untuk menghindari blokir
2. **Data Sintetis**: Jika scraper tidak berjalan (tidak ada credential atau error), aplikasi akan otomatis menggunakan data sintetis
3. **Fallback Heuristic**: Jika API key AI tidak ada atau token habis, aplikasi akan menggunakan analisis heuristic
4. **Cookies**: Pastikan cookies untuk Twitter/X dan TikTok selalu diperbarui secara berkala

## 🤝 Kontribusi

Kontribusi selalu dipersilakan! Silakan:
1. Fork repository
2. Buat branch fitur (`git checkout -b fitur-baru`)
3. Commit perubahan (`git commit -m 'Menambahkan fitur X'`)
4. Push ke branch (`git push origin fitur-baru`)
5. Buat Pull Request ke branch `development`

## 📄 Lisensi

Proyek ini menggunakan lisensi MIT - lihat [LICENSE](LICENSE) untuk detail.

## 📧 Kontak

Untuk pertanyaan atau masalah, silakan buka Issue di repository GitHub.

---

Dibuat dengan ❤️ untuk memantau dan melawan disinformasi!
