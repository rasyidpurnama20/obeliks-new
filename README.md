# OBELIKS — RPS OBE Studio

Fondasi aplikasi penyusunan dan validasi RPS berbasis Outcome-Based Education. Prototipe asli tetap tersedia sebagai `rps-main.html`, sedangkan scaffold ini menyiapkan jalur menuju aplikasi produksi.

## Stack utama

- **Next.js 16 + TypeScript** — web, Server Components, dan Route Handlers dalam satu codebase.
- **Supabase PostgreSQL** — Auth, Storage, Realtime, Row Level Security, JSONB, dan pgvector tanpa memecah data ke banyak layanan.
- **OpenAI Responses API + Zod Structured Outputs** — ekstraksi RPS menjadi objek tervalidasi, bukan JSON bebas.
- **Python FastAPI + Docling** — parser terisolasi untuk PDF, DOCX, XLSX, PPTX, HTML, gambar, dan ZIP berisi dokumen.
- **Docker** — parser dapat dijalankan dan ditingkatkan kapasitasnya secara independen dari web.

Keputusan dan alur data lengkap ada di [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Menjalankan web

1. Salin `.env.example` menjadi `.env.local` dan isi kredensial server.
2. Instal dependensi: `pnpm install`.
3. Jalankan: `pnpm dev`.
4. Buka `http://localhost:3000`; prototipe tersedia di `/prototype`.

## Menjalankan parser

```bash
docker compose up --build parser
```

Health check parser: `http://localhost:8001/health`.

## Menyiapkan basis data

1. Buat proyek Supabase.
2. Jalankan `supabase/migrations/0001_core.sql` melalui Supabase CLI atau SQL Editor.
3. Buat bucket Storage privat bernama `rps-source`.
4. Aktifkan Realtime untuk tabel `document_jobs` jika progres perlu tampil langsung.

## Strategi implementasi

1. Pertahankan prototipe untuk validasi UX.
2. Hubungkan unggah file ke Storage dan buat baris `document_jobs`.
3. Kirim file ke parser; simpan Markdown/JSON hasil normalisasi.
4. Jalankan ekstraksi AI melalui `/api/ai/extract`.
5. Tampilkan field ber-confidence rendah sebagai caution dan wajibkan konfirmasi manusia sebelum publikasi.

Kunci service role dan API AI hanya boleh berada di server. Jangan pernah menggunakan keduanya dari browser.
Endpoint `/api/ai/extract` mewajibkan Supabase access token pada header `Authorization: Bearer <token>` dan memeriksa keanggotaan organisasi sebelum memanggil model.
