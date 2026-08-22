# OBELIKS — RPS OBE Studio

Fondasi aplikasi penyusunan dan validasi RPS berbasis Outcome-Based Education dengan strategi **free-tier first, self-host ready**.

## Jalur yang digunakan sekarang

- **GitHub** — source code dan pull request.
- **Vercel Hobby** — Next.js, API ringan, parser PDF/DOCX ringan.
- **Supabase Free** — PostgreSQL, Auth, Storage, Realtime, RLS, JSONB, dan pgvector.
- **Rules-only mode** — validasi dasar tetap berjalan tanpa biaya AI.
- **OpenAI opsional** — hanya aktif jika `AI_MODE=openai` dan API key tersedia.

Python/Docling tetap ada di `services/parser`, tetapi bukan syarat deployment awal. Ketika server sendiri tersedia, cukup deploy container tersebut dan isi `PARSER_SERVICE_URL`; dokumen berat otomatis memakai enhanced parser.

## Kemampuan parser

| Kondisi | Sekarang di Vercel | Setelah ada server |
|---|---|---|
| PDF teks biasa | Ya | Ya |
| DOCX | Ya | Ya |
| TXT/Markdown/HTML | Ya | Ya |
| PDF scan/OCR | Ditandai untuk enhanced parser | Ya |
| ZIP dan Office lama | Disimpan, lalu ditandai untuk enhanced parser | Ya |
| File besar/kompleks | Ditandai untuk enhanced parser | Ya |

File diunggah langsung dari browser ke Supabase Storage melalui signed upload URL, sehingga tidak melewati batas body Vercel Function.

## Dokumentasi

- [`docs/DEPLOYMENT_FREE.md`](docs/DEPLOYMENT_FREE.md) — langkah setelah login Supabase dan Vercel.
- [`docs/SELF_HOSTING.md`](docs/SELF_HOSTING.md) — rencana pemindahan ke server sendiri.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — keputusan arsitektur dan alur data.

## Menjalankan lokal

1. Salin `.env.example` menjadi `.env.local`.
2. Jalankan `npm install` lalu `npm run dev`.
3. Buka `http://localhost:3000`; prototipe tersedia di `/prototype`.

## Endpoint fondasi

- `GET /api/health` — status konfigurasi tanpa membocorkan secret.
- `POST /api/uploads/sign` — membuat dokumen dan signed upload URL Supabase.
- `POST /api/documents/parse` — parser gratis dengan fallback otomatis ke Docling.
- `POST /api/ai/extract` — ekstraksi terstruktur opsional.

Semua endpoint mutasi membutuhkan Supabase access token dan memeriksa keanggotaan organisasi. Service-role key, parser token, dan API key AI hanya boleh disimpan sebagai server environment variables.

