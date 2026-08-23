# Admin — Pengguna & Akses

Modul ini adalah bagian dashboard pertama yang memakai data Supabase nyata. Admin platform dapat mengelola identitas dan peran tanpa memberi hak akademik secara implisit.

## Batas otorisasi

- Aktor CRUD wajib memiliki session cookie yang valid, `profiles.status = active`, dan `platform_roles.role = superadmin`.
- Pemeriksaan tersebut diulang pada setiap Server Action sebelum service-role client dibuat.
- Admin tidak dapat mengubah, menangguhkan, atau mengarsipkan akunnya sendiri.
- Akun `superadmin` lain juga dilindungi. Role platform tidak pernah diterima dari payload form.
- Role yang dapat diberikan adalah `kaprodi`, `gpm`, `dosen`, dan `mahasiswa`; satu akun dapat memiliki lebih dari satu role.
- `user_role_assignments` sengaja tidak membuat `organization_members`. Dengan demikian role dashboard baru tidak mewarisi policy akademik lama.
- Ketika Admin memutasi akun, membership akademik lama pada organisasi yang dikelola dicabut dan direkam dalam audit. Ini mencegah role yang diturunkan—misalnya menjadi Mahasiswa—diam-diam mempertahankan hak Dosen/Reviewer lama.

## Lifecycle akun

| Status | Makna | Cara masuk |
|---|---|---|
| `invited` | Undangan sudah dikirim, email belum selesai diverifikasi | Selesaikan tautan email dan buat kata sandi |
| `active` | Email terverifikasi dan minimal satu role tersedia | Login biasa |
| `suspended` | Akses sementara dihentikan; role disimpan | Admin mengaktifkan setelah email terverifikasi |
| `archived` | Offboarding; seluruh role aplikasi dicabut | Tidak dapat login |

Create menggunakan `inviteUserByEmail`; aplikasi tidak membuat atau menampilkan password default. Edit MVP mencakup nama dan role. Email dibuat read-only karena perubahan identitas harus memiliki alur verifikasi ulang tersendiri.

“Delete” diwujudkan sebagai **Arsipkan akun**. Seluruh role dashboard dan membership akademik lama akun dicabut lintas organisasi, sedangkan Auth user dan profile tetap disimpan agar foreign key pembuat RPS, keputusan, dan audit tidak hilang. Hard delete hanya dipakai sebagai kompensasi bila undangan baru berhasil dibuat tetapi transaksi profile/role/audit gagal sebelum akun pernah aktif.

Nama pada `profiles.display_name` adalah sumber kanonik. Edit MVP tidak menulis `user_metadata` Auth secara terpisah, dan trigger Auth hanya mengambil metadata nama saat identity pertama dibuat. Perubahan metadata mandiri setelahnya tidak dapat menimpa nama profil teraudit.

Pengiriman ulang akses dibedakan secara eksplisit: akun yang belum terverifikasi menerima tautan onboarding untuk akun yang sudah ada, sedangkan akun terverifikasi menerima tautan reset sandi. Keduanya menuju `/reset-password`, tidak pernah menampilkan token, dan memiliki catatan audit `requested` sebelum email dikirim serta `sent` atau `failed` sesudah hasil provider diketahui.

## Urutan fail-closed

- Suspend: status database berubah lebih dulu, lalu Auth user diban. JWT lama langsung gagal pada `is_active_user()`.
- Activate: Auth user dibuka lebih dulu saat profile masih nonaktif; status `active` ditulis terakhir. Jika transaksi gagal, akun tetap ditolak oleh profile dan diban kembali.
- Archive: status `archived`, pencabutan seluruh role dashboard dan membership akademik lama lintas organisasi, serta audit disimpan atomik; ban Auth dilakukan setelahnya.
- Create: undangan Auth dilanjutkan dengan RPC atomik profile/role/audit. Kegagalan RPC menghapus akun baru atau minimal membannya bila kompensasi delete gagal.

Jika sinkronisasi ban Auth gagal setelah Suspend/Archive, status profile tetap menolak seluruh route aplikasi dan RLS. Aplikasi menambahkan event `account.auth_sync_pending` serta menampilkan peringatan kepada Admin agar kegagalan provider tidak tersembunyi sebagai sukses penuh.

## Data nyata dan data contoh

- Nyata: session, profile, status akun, email confirmation, role assignment, last sign-in, undangan, suspend/activate, archive, dan audit mutasi akun.
- Masih contoh: penugasan dosen–mata kuliah, kalender/periode, RPS, review, publikasi, metrik akademik, serta isi dashboard per role.

Migrasi yang wajib diterapkan: `20260823100000_admin_user_management.sql`. Organisasi yang dikelola ditentukan oleh `OBELIKS_ORGANIZATION_SLUG` dan default ke `informatika-undip`.
