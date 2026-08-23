# Rencana MVP Sederhana — Fase 1–3

## Tujuan tunggal

MVP hanya membuktikan satu alur end-to-end:

**Admin menugaskan mata kuliah → Dosen menyusun RPS → GPM meninjau → Kaprodi menyetujui dan menerbitkan → Mahasiswa membaca.**

AI, parser canggih, analitik ketercapaian, jurnal perkuliahan, evaluasi kelas, dan mesin periode kompleks ditunda. Template DOCX tetap tersedia, tetapi editor manual dan validasi aturan dasar menjadi jalur utama.

## Menu minimum per peran

| Peran | Menu yang tampil pada MVP |
|---|---|
| Admin | Dashboard, Data Master, Penugasan, Monitoring RPS |
| Kaprodi | Dashboard, Review & Terbitkan, Monitoring RPS |
| GPM | Dashboard, Review RPS, Monitoring RPS |
| Dosen | Dashboard, Pengajaran Saya |
| Mahasiswa | RPS Terbit |

`Pengajaran Saya` selalu terbuka di sidebar Dosen dan hanya memiliki tiga submenu:

1. **Mata Kuliah Saya** — daftar penugasan.
2. **Susun RPS** — satu workspace RPS.
3. **Status & Catatan** — revisi, review, dan status terbit.

## Lima status RPS

| Status | Pemilik aksi berikutnya |
|---|---|
| Draft | Dosen |
| Diajukan | GPM |
| Revisi | Dosen |
| Menunggu Kaprodi | Kaprodi |
| Terbit | Mahasiswa dapat membaca |

Tidak ada status lain pada permukaan MVP. Status teknis upload/parser tidak dicampur dengan status akademik ini.

| Dari | Aktor dan aksi | Menjadi |
|---|---|---|
| Draft | Dosen — Ajukan | Diajukan |
| Diajukan | GPM — Minta Revisi | Revisi |
| Diajukan | GPM — Lolos Review | Menunggu Kaprodi |
| Revisi | Dosen — Ajukan Ulang | Diajukan |
| Menunggu Kaprodi | Kaprodi — Kembalikan | Revisi |
| Menunggu Kaprodi | Kaprodi — Terbitkan | Terbit |
| Terbit | Dosen — Buat Versi Revisi | Draft baru; versi lama tetap Terbit |

`Minta Revisi` dan `Kembalikan` tidak membuka kembali versi yang sedang direview. Sistem menutup versi tersebut di riwayat lalu membuat working copy penerus berstatus `Revisi`; saat diajukan ulang, working copy dibekukan sebagai versi baru.

## Fase 1 — Data master dan akses

### Dibangun

- Satu institusi/prodi dan satu periode aktif dengan tanggal mulai, tenggat, dan tombol kunci sederhana.
- Data dosen, mata kuliah, dan CPL dari snapshot publik IF UNDIP.
- Akun untuk dosen hanya setelah email institusi dikonfirmasi Admin.
- Penugasan `dosen ↔ mata kuliah ↔ periode` dilakukan manual oleh Admin.
- Hak akses lima peran ditegakkan di server dan database, bukan hanya menyembunyikan menu.

### Tidak dibangun

- Sinkronisasi SSO/SIA otomatis.
- Kalender kebijakan per menu, pengecualian kompleks, delegasi, atau impersonasi.
- Penugasan otomatis berdasarkan kepakaran.

### Selesai jika

- Admin dapat mengaktifkan satu periode, mengelola pengguna, dan membuat penugasan.
- Dosen hanya melihat mata kuliah yang ditugaskan.
- GPM/Kaprodi hanya melihat lingkup prodi.
- Mahasiswa tidak dapat membaca draft.

## Fase 2 — Penyusunan RPS

### Dibangun

Satu halaman RPS dengan enam langkah yang mengikuti `workflowSteps` pada manifest template resmi:

| Langkah UI | Bagian template yang diisi pada MVP |
|---|---|
| Identitas Mata Kuliah | Identitas, otorisasi, dan deskripsi mata kuliah |
| Capaian Pembelajaran | CPL, CPMK, Sub-CPMK, pemetaan, prasyarat, dan referensi |
| Alignment OBE | Course outline, distribusi bahan kajian, serta pembobotan CPMK–CPL |
| Asesmen & Metode | Desain asesmen, rencana evaluasi, rubrik, butir asesmen, dan register bukti |
| Rencana Mingguan | Rencana pembelajaran per pertemuan |
| Validasi & Pengesahan | Ringkasan validasi; rekaman pengesahan dibuat oleh workflow, bukan diisi Dosen |

Pengajuan MVP mewajibkan sembilan bagian authoring (`course-identity` sampai `rubrics-and-evidence`). Bagian `attainment` serta `delivery-and-improvement` ditunda ke fase evaluasi lanjutan. Bagian `approval` dihasilkan dari keputusan GPM/Kaprodi.

Dosen dapat menyimpan draft, mengunduh template DOCX kosong, dan mengajukan RPS. CPMK ditulis oleh dosen/prodi; sistem tidak mengarang CPMK dari nama mata kuliah, topik silabus, atau AI.

### Validasi minimum

- Semua sembilan bagian authoring wajib terisi.
- Setiap CPMK terhubung ke minimal satu CPL.
- Setiap asesmen terhubung ke CPMK.
- Total bobot asesmen tepat 100%.
- Rencana pertemuan tidak kosong.
- Dosen hanya dapat mengubah RPS pada penugasannya dan sebelum periode dikunci.

### Selesai jika

- Satu RPS dapat dibuat dari nol, disimpan, dibuka kembali, dan diajukan.
- Data yang tidak valid ditolak dengan pesan yang jelas.
- Versi yang sudah diajukan tidak berubah diam-diam.

## Fase 3 — Review dan publikasi

### Dibangun

- GPM membaca RPS, memberi catatan per bagian, lalu memilih **Minta Revisi** atau **Lolos Review**.
- Kaprodi membaca RPS berstatus `Menunggu Kaprodi`, lalu memilih **Kembalikan** atau **Terbitkan**.
- Dosen melihat seluruh catatan dan mengajukan ulang versi revisi.
- Mahasiswa melihat katalog seluruh RPS berstatus `Terbit` dan dapat mengunduhnya. Filter personal berdasarkan mata kuliah yang diambil ditunda sampai roster/enrollment resmi tersedia.
- Monitoring hanya berupa jumlah RPS per lima status dan daftar yang melewati tenggat.

### Aturan sederhana

- Penyusun tidak boleh mereview atau menyetujui RPS yang sama.
- GPM tidak mengedit isi RPS.
- Kaprodi tidak melewati tahap review GPM.
- RPS lama tetap terbaca mahasiswa sampai versi penggantinya terbit.
- Keputusan dan catatan pada versi yang dikembalikan tetap tersimpan di riwayat immutable.
- Setiap perubahan status mencatat waktu, aktor, dan catatan singkat.

### Selesai jika

- Satu RPS berhasil melewati alur Draft → Diajukan → Menunggu Kaprodi → Terbit.
- Skenario Revisi → Diajukan ulang juga berhasil.
- Akses negatif untuk setiap peran lulus pengujian.

## Data awal IF UNDIP

Snapshot pada [`IF_UNDIP_PUBLIC_DATA.md`](./IF_UNDIP_PUBLIC_DATA.md) menyediakan 36 dosen, 83 kode mata kuliah Kurikulum 2024 OBE, dan 12 CPL. Penugasan dosen–mata kuliah, CPMK, serta matriks CPL–mata kuliah belum dipublikasikan, sehingga ketiganya tetap menjadi input resmi Admin/Dosen, bukan hasil inferensi sistem.

## Batas MVP

Fitur berikut baru dipertimbangkan setelah tiga fase di atas lulus end-to-end:

- AI & parser otomatis;
- jurnal pelaksanaan dan evaluasi ketercapaian;
- dashboard analitik Level 3/4;
- notifikasi multi-kanal;
- ekspor dokumen terisi dan tanda tangan digital;
- audit viewer lanjutan dan konfigurasi kebijakan detail.
