# Pemindahan ke server sendiri

Tidak perlu menulis ulang aplikasi. Target akhir tetap terdiri dari tiga container/stack: Next.js, self-hosted Supabase, dan enhanced parser.

## Persiapan server

- Linux dengan Docker Engine dan Docker Compose.
- Domain/subdomain untuk web, Supabase API, dan Supabase Studio.
- HTTPS melalui reverse proxy.
- Backup volume database dan storage sebelum produksi.

## 1. Deploy self-hosted Supabase

Gunakan Docker Compose resmi Supabase. Samakan versi Postgres dan extension yang digunakan (`pgcrypto`, `vector`) sebelum restore.

## 2. Pindahkan database Supabase Cloud

Gunakan Supabase CLI, bukan raw `pg_dump`, agar schema internal Supabase difilter dengan benar:

```bash
supabase db dump --db-url "<PLATFORM_CONNECTION_STRING>" -f roles.sql --role-only
supabase db dump --db-url "<PLATFORM_CONNECTION_STRING>" -f schema.sql
supabase db dump --db-url "<PLATFORM_CONNECTION_STRING>" -f data.sql --use-copy --data-only
```

Restore ke self-hosted Supabase sesuai panduan resmi. Database dump membawa schema, data, RLS, trigger, dan `auth.users`. JWT secret, OAuth setting, SMTP, DNS, serta Storage objects harus dipindahkan/diatur terpisah.

## 3. Pindahkan Storage

Salin object dari bucket cloud `rps-source` ke bucket self-hosted dan pertahankan path object. Karena database menyimpan `source_path`, path yang sama mencegah migrasi ulang setiap baris dokumen.

## 4. Jalankan web

Build image portable dari root repository:

```bash
docker build -t obeliks-web .
docker run --env-file .env.production -p 3000:3000 obeliks-web
```

Ganti URL/key Supabase pada `.env.production` ke instance self-hosted. Kode aplikasi tidak berubah.

## 5. Aktifkan enhanced parser

```bash
docker compose up --build parser
```

Atur pada container web:

```text
PARSER_SERVICE_URL=http://parser:8001
PARSER_SERVICE_TOKEN=<random-long-secret>
```

Setelah itu, file ZIP, Office lama, PDF scan, atau file besar otomatis memakai parser Docling melalui endpoint yang sama.

## 6. Cutover aman

1. Lakukan restore percobaan pada server nonproduksi.
2. Bandingkan jumlah pengguna, organisasi, course, dokumen, dan job.
3. Uji login ulang karena token cloud lama tidak berlaku setelah JWT secret berubah.
4. Uji unduh file Storage dan parser untuk DOCX, PDF, ZIP, serta PDF scan.
5. Turunkan TTL DNS, hentikan write sementara, lakukan dump final, lalu arahkan domain.
6. Pertahankan Supabase Cloud beberapa hari sebagai rollback read-only sebelum dihapus.

