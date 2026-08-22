# Deployment gratis: GitHub + Vercel + Supabase

Panduan ini mengasumsikan pull request sudah digabung ke branch `main`.

> Status saat ini: fondasi deployment, endpoint, database, dan parser sudah tersedia. Halaman login, upload, serta review masih menjadi milestone UI berikutnya; jadi deployment awal menampilkan prototipe dan health check terlebih dahulu.

## 1. Setelah login Supabase

1. Klik **New project** dan pilih region terdekat dengan pengguna utama; untuk Indonesia biasanya Singapore adalah pilihan praktis.
2. Simpan database password di password manager.
3. Buka **SQL Editor** dan jalankan migration berikut secara berurutan:
   - `supabase/migrations/0001_core.sql`
   - `supabase/migrations/0002_storage.sql`
4. Buka **Project Settings → API** dan catat:
   - Project URL
   - anon/public key
   - service_role key
5. Jangan menaruh `service_role` key pada variabel yang diawali `NEXT_PUBLIC_`.
6. Di **Authentication → Providers**, aktifkan Email terlebih dahulu. OAuth dapat ditambahkan setelah domain produksi tersedia.

## 2. Setelah login Vercel

1. Klik **Add New → Project**.
2. Hubungkan GitHub dan pilih repository `rasyidpurnama20/obeliks-new`.
3. Gunakan branch produksi `main`; Framework Preset akan terdeteksi sebagai Next.js.
4. Tambahkan environment variables berikut untuk Production, Preview, dan Development:

```text
NEXT_PUBLIC_SUPABASE_URL=<Project URL Supabase>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service_role key>
SUPABASE_STORAGE_BUCKET=rps-source
AI_MODE=disabled
SERVERLESS_PARSER_MAX_MB=10
SERVERLESS_PARSER_MAX_PAGES=80
SERVERLESS_PARSER_TIMEOUT_MS=45000
```

5. Jangan isi `PARSER_SERVICE_URL` selama belum ada server sendiri.
6. Klik **Deploy**.

## 3. Hubungkan URL produksi kembali ke Supabase

1. Salin URL produksi Vercel, misalnya `https://obeliks-new.vercel.app`.
2. Di Supabase buka **Authentication → URL Configuration**.
3. Isi **Site URL** dengan URL produksi.
4. Tambahkan redirect URL produksi dan preview yang memang akan digunakan.
5. Jika ada perubahan environment variables, lakukan redeploy di Vercel.

## 4. Verifikasi

1. Buka `/api/health`; status harus `ready` dan `aiMode` harus `disabled`.
2. Buka `/prototype`; seluruh prototipe harus tampil.
3. Pastikan bucket `rps-source` bersifat private.
4. Pastikan tidak ada service-role key atau API key di repository, browser bundle, atau log.

## 5. AI opsional

Deployment dasar tidak memerlukan OpenAI. Rules engine tetap berjalan gratis. Jika nanti ingin mengaktifkan AI:

1. Buat project API terpisah agar pemakaian mudah dipantau.
2. Pasang hard monthly spend limit yang kecil.
3. Tambahkan `OPENAI_API_KEY` hanya di Vercel server environment.
4. Ubah `AI_MODE=openai` dan redeploy.

## Batas yang perlu diketahui

- Parser gratis cocok untuk RPS DOCX/PDF berbasis teks, bukan OCR kompleks.
- ZIP dan dokumen besar tetap boleh disimpan, tetapi prosesnya menunggu enhanced parser.
- Supabase Free mempunyai kuota; pantau Database, Storage, Egress, Auth, dan Realtime dari dashboard.
- Jangan mengunggah file melalui body Vercel Function; selalu gunakan signed upload URL.
