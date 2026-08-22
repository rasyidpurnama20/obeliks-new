# Aktivasi login dan superadmin

## 0. Sebelum merge: wajib siapkan koneksi migration

Pastikan secret GitHub `SUPABASE_DB_URL` sudah ada. Cara mengambil Session Pooler URI dan menyimpannya dijelaskan pada `docs/DEPLOYMENT_FREE.md` bagian 1. Tanpa secret ini, migration produksi setelah merge akan berhenti dengan aman.

Setelah itu, gabungkan pull request ke `main` dan ikuti langkah berikut.

## 1. Tunggu migrasi Supabase

1. Buka GitHub → **Actions** → **Database migrations**.
2. Pastikan proses dari commit hasil merge berstatus hijau.
3. Jika gagal, buka log langkah yang merah; jangan jalankan bootstrap sebelum migration berhasil.

## 2. Atur Supabase Auth

1. Buka Supabase → **Authentication** → **URL Configuration**.
2. Isi **Site URL** dengan URL production Vercel, contoh `https://obeliks-new.vercel.app`.
3. Tambahkan dua **Redirect URL**:
   - `https://obeliks-new.vercel.app/auth/callback`
   - `https://obeliks-new.vercel.app/reset-password`
4. Simpan. Ganti URL contoh dengan domain production Anda.

Tidak perlu mengaktifkan pendaftaran publik. Akun pertama dibuat melalui undangan aman.

## 3. Tambahkan secret GitHub

Buka repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**:

- `SUPABASE_URL`: Project URL dari Supabase.
- `SUPABASE_SERVICE_ROLE_KEY`: service-role/secret key Supabase.

Jangan pernah menaruh service-role key di source code atau variable berawalan `NEXT_PUBLIC_`.

## 4. Buat superadmin pertama

1. Buka GitHub → **Actions** → **Bootstrap superadmin**.
2. Klik **Run workflow** pada branch `main`.
3. Email superadmin sudah dikunci ke `rasyid.purnama20@gmail.com`; isi URL production Vercel.
4. Jalankan, lalu tunggu status hijau.
5. Buka email undangan, buat kata sandi, lalu login.

Jika email tersebut sudah ada, workflow hanya memberi role superadmin. Gunakan **Lupa kata sandi** pada halaman login bila diperlukan.

## 5. Atur Vercel Production

Buka Vercel → project OBELIKS → **Settings** → **Environment Variables**. Isi untuk **Production**:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (publishable/anon key)
- `SUPABASE_SERVICE_ROLE_KEY`
- variable parser/storage lain dari `.env.example`

Lalu buka **Deployments** dan **Redeploy** deployment production terbaru bila variable baru ditambahkan setelah deploy. Jangan mengisi **Output Directory**; build mengikuti `vercel.json`.

Untuk Preview, jangan pasang service-role production. Preview dapat dibiarkan tanpa login sampai tersedia project Supabase staging terpisah.

## Hasil akhir

- `/` adalah login.
- `/reset-password` hanya dipakai melalui tautan email.
- `/admin` hanya dapat dibuka profil aktif dengan role `superadmin`.
- Kata sandi diatur sendiri oleh pemilik akun dan tidak tersimpan di GitHub.
