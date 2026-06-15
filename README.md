# BuzzTrack — Pemindai Disinformasi Multi-Platform

Dashboard deteksi disinformasi multi-platform dengan data riil dari scrapers Twitter/X, YouTube, dan TikTok, analitik botnet berbasis AI (Gemini/OpenRouter/Opencode), visualisasi cluster jaringan, dan manajemen konfigurasi scraper via UI.

## Fitur Utama

1. **Intel Kampanye** — Deteksi dan analisis kampanye disinformasi dari data scraper riil
2. **Profil Entitas** — Skor bot, analisis akun mencurigakan, riwayat aktivitas
3. **Matriks Jaringan** — Visualisasi graf interaktif hubungan akun-kampanye (zoom, pan, filter platform, AI clustering)
4. **Analitik Sosial** — Dashboard statistik multi-platform, demografi, distribusi konten
5. **Tren Harian** — Insight tren dari scraper dengan analisis AI (fallback heuristic jika token AI habis)
6. **Analis Ancaman** — Analisis konten berbahaya menggunakan AI
7. **Sentimen Analysis** — Analisis sentimen real-time dari hasil scraper
8. **Pencarian OSINT** — Pemindaian berdasarkan kata kunci di semua platform
9. **Pengaturan Scraper** — Konfigurasi API key dan cookies via UI (tersimpan di JSON + env)

## Struktur Proyek

```
buzztrack/
├── data/                       # Persistence (LowDB JSON files)
│   ├── db.json                 #   Database utama (LowDB)
│   ├── campaigns.json          #   File repository kampanye
│   ├── accounts.json           #   File repository akun
│   └── scraper-config.json     #   Konfigurasi scraper dari UI
├── scrapers/                   # Python scraper scripts
│   ├── requirements.txt
│   ├── run_scraper.py
│   ├── twitter_scraper.py      # Twitter/X (via twitter-cli + cookies)
│   ├── youtube_scraper.py      # YouTube (via yt-dlp, no API key needed)
│   └── tiktok_scraper.py       # TikTok (via TikTokApi + Playwright)
├── src/                        # Frontend (React + TypeScript + Vite)
│   ├── components/
│   ├── core/                   # Clean Architecture
│   │   ├── domain/entities/
│   │   ├── domain/repositories/
│   │   └── use-cases/
│   ├── infrastructure/
│   │   ├── repositories/       # FileCampaignRepository dkk.
│   │   └── services/           # AIService (Gemini/OpenRouter/Opencode)
│   ├── settings/
│   ├── App.tsx
│   └── api.ts
├── .env.example
├── Dockerfile                  # Multi-stage build (non-root user, Playwright)
├── docker-compose.yml
├── entrypoint.sh               # Fix volume permissions at runtime
├── server.ts                   # Backend Express (API + WebSocket + static)
├── vite.config.ts
└── package.json
```

## Persyaratan

- **Node.js** >= 18
- **Python** >= 3.8 (untuk scraper)
- **NPM**

## Instalasi & Menjalankan (Local Development)

```bash
# 1. Install dependencies
npm install
cd scrapers && pip install -r requirements.txt && cd ..

# 2. Konfigurasi .env (salin dari .env.example)
copy .env.example .env
# lalu isi credentials

# 3. Jalankan backend + frontend bersamaan
npm run dev
```

- Frontend (Vite): **http://localhost:3000**
- Backend API: **http://localhost:3001**
- Vite proxy `/api` → backend 3001

## Docker (Production)

```bash
docker compose up -d buzztrack
```

- Container `buzztrack` sebagai non-root user
- Frontend statis: **port 3000**
- Backend API: **port 3001**
- Data persist di volume `buzztrack_data:/app/data`
- Playwright browsers pre-installed di `/app/.cache/ms-playwright`
- Health check via `GET /api/campaigns` (port 3001)

### Environment Variables (Docker)

Semua variabel dari `.env` disubstitusi oleh Docker Compose ke `environment:` block dan juga di-mount sebagai volume `./.env:/app/.env:ro` untuk dibaca `dotenv.config()`.

## Credential Scraper

| Platform | Env Var | Cara Dapatkan |
|----------|---------|---------------|
| Twitter/X | `TWITTER_COOKIES` | Cookie `auth_token` + `ct0` setelah login di browser |
| YouTube | `YOUTUBE_API_KEY` | Google Cloud Console (optional, yt-dlp works without it) |
| TikTok | `TIKTOK_MS_TOKEN` | Cookie `ms_token` dari tiktok.com setelah login |

**Zero synthetic data** — Semua data harus dari scraper riil. Jika scraper gagal atau tidak dikonfigurasi, aplikasi return `no_data` tanpa fallback dummy.

## API Key AI

- **Gemini**: API key dari Google AI Studio
- **OpenRouter**: API key dari openrouter.ai
- **Opencode**: API key dari opencode.ai

Caching AI 5 menit TTL. Jika token habis, fallback ke heuristic analysis.

## Deployment (CI/CD)

GitHub Actions workflow (`.github/workflows/ci.yml`):
- Build Docker image → push ke ghcr.io
- Deploy via SSH ke server (skip jika secrets tidak dikonfigurasi)
- Branch `development` dan `main`

## Tech Stack

| Layer | Teknologi |
|-------|-----------|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS 4, Recharts, Lucide |
| Backend | Express.js, ws (WebSocket), LowDB v5 |
| Scrapers | twitter-cli, yt-dlp, TikTokApi + Playwright |
| AI | Google Gemini API, OpenRouter API, Opencode API |
| Docker | Multi-stage build, BuildKit cache, non-root user `buzztrack` |

## Lisensi

MIT
