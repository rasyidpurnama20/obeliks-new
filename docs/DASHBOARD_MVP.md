# Dashboard berbasis peran — MVP

Dokumen ini menetapkan batas MVP dashboard OBELIKS. Target PR ini adalah **MVP UI navigabel untuk seluruh modul utama** guna memvalidasi navigasi, prioritas informasi, dan batas peran. Data bisnisnya masih fixture sintetis; aksi yang belum memiliki command backend dilabeli sebagai simulasi. Autentikasi superadmin dan keluar tetap memakai Supabase yang sudah ada.

## Pemanfaatan prototipe sumber

Keempat prototipe tidak disalin sebagai HTML monolitik. Bahasa visual dan contoh permukaan alurnya diringkas ke shell Next.js yang konfiguratif. Kalkulator/domain engine prototipe belum dipindahkan pada PR ini; skor analitik yang tampil tetap fixture dan diberi batas yang jelas.

| Sumber | Yang dimanfaatkan | Modul MVP |
|---|---|---|
| `rps-obe-studio-prototype.html` | Shell modern, upload-first, pipeline, saran AI dengan persetujuan, validation gate, dan versi | Fondasi visual dashboard, contoh sumber dokumen, `Pengajaran Saya > RPS`, `AI & Parser` |
| `rps-obe-level2.html` | Sidebar berjenjang satu level, struktur outcome, alignment, asesmen, rencana mingguan, dan quality inspector | Submenu Dosen serta enam langkah `RPS & Alignment` dengan validation gate rules-only |
| `rps-obe-level3.html` | Health score, coverage, gap, dan rekomendasi | Sampling insight kurikulum pada `Monitoring RPS` untuk Admin/Kaprodi/GPM |
| `rps-obe-level4-fixed.html` | Bukti pelaksanaan, ketercapaian outcome, dan corrective action | Jurnal pelaksanaan aktif serta contoh evaluasi historis read-only |

Detail mahasiswa dari Level 4 kelak hanya boleh dilihat dosen pada kelas yang ditugaskan. Kaprodi dan GPM menerima agregat yang sesuai lingkup, sedangkan mahasiswa hanya menerima RPS yang telah dipublikasikan.

## Cakupan MVP

Satu shell menyediakan permukaan inti berikut dengan fixture terpusat:

- Dashboard berbeda untuk Admin, Kaprodi, GPM, Dosen, dan Mahasiswa.
- Sidebar adaptif: `Dashboard`, `Institusi & Periode`, `Pengguna & Akses`, `Monitoring RPS`, `Pengajaran Saya`, `RPS Saya`, serta grup sistem `AI & Parser`, `Audit Log`, dan `Pengaturan`.
- Ringkasan periode dan penguncian, penugasan, pengguna, status workflow RPS, layanan parser/AI, dan audit.
- `Pengajaran Saya` untuk Dosen selalu membuka submenu `Mata Kuliah Saya`, `RPS & Alignment`, `Pelaksanaan`, `Evaluasi`, dan `Riwayat`; konteks mata kuliah wajib dipilih sebelum membuka tahap.
- Workspace mata kuliah dengan jalur terpisah untuk `RPS`, `Pelaksanaan`, `Evaluasi`, dan `Riwayat`, termasuk deep-link `#pengajaran-saya/{courseOfferingId}/{tahap}`.
- Template DOCX resmi dapat diunduh langsung; checksum, urutan bagian, policy dependency, dan gate validasinya berada dalam manifest berversi.
- Tampilan mahasiswa read-only untuk RPS terbit.
- Preview peran, navigasi antarmodul, filter, tab, toggle, dan umpan balik interaksi sederhana.
- Layout responsif yang mempertahankan bahasa visual Studio.

`Preview peran` adalah alat demonstrasi client-side, **bukan impersonasi dan bukan otorisasi**. Preview ini menampilkan satu persona/peran pada satu waktu. Pada produksi, pilihan peran hanya berasal dari role yang benar-benar dimiliki pengguna.

## Model peran dan kapabilitas

Akses produksi harus dihitung dari `role + scope organisasi/prodi + assignment`, lalu ditegakkan kembali pada server dan RLS. Menyembunyikan menu saja tidak cukup.

| Peran | Kapabilitas utama | Batas penting |
|---|---|---|
| Admin | Institusi, periode, akses, monitoring global, AI/parser, audit, pengaturan | Tidak otomatis boleh mengubah atau mengesahkan isi akademik |
| Kaprodi | Monitoring prodi, penugasan, permintaan revisi, pengesahan akhir | Tidak boleh mengesahkan RPS yang disusun sendiri |
| GPM | Review mutu, komentar, minta revisi, lolos review mutu | Tidak mengedit isi dosen dan tidak memberi pengesahan akhir |
| Dosen | Mata kuliah yang ditugaskan; susun, ajukan, jalankan, evaluasi, perbaiki | Pengajuan tim hanya oleh penanggung jawab yang ditetapkan |
| Mahasiswa | Melihat dan mengunduh RPS terbit untuk mata kuliah yang diambil | Tidak melihat draft, komentar, skor AI, audit, atau data mahasiswa lain |

Role produksi bersifat aditif. Kaprodi/GPM/Admin yang juga mendapat penugasan dosen kelak memperoleh `Pengajaran Saya` melalui kapabilitas penugasan, bukan otomatis karena role tata kelolanya. Preview MVP memisahkan persona, sehingga menu tersebut hanya muncul pada persona Dosen. Aktivitas harus dicatat bersama role aktif dan penyusun tidak boleh menjadi reviewer atau pengesah dokumen yang sama.

Portal Mahasiswa memakai proyeksi publik terpisah. Versi kerja terbaru dapat tetap `draft`, `revision`, atau `awaiting_approval`, sementara mahasiswa terus melihat versi efektif sebelumnya sampai versi baru disahkan dan dipublikasikan.

## Tiga status yang harus dipisahkan

Kolom `rps_documents.status` saat ini mencampur status mesin (`queued`, `parsing`, `extracting`, `failed`) dengan status akademik (`draft`, `review`, `approved`). Ini menimbulkan transisi ambigu dan menyulitkan izin, retry, serta pelaporan.

| Dimensi | Contoh | Kegunaan |
|---|---|---|
| `processing_status` | `queued`, `parsing`, `extracting`, `ready`, `failed` | Kondisi pipeline teknis; dapat di-retry tanpa mengubah keputusan akademik |
| `workflow_status` | `draft`, `submitted`, `quality_review`, `revision_requested`, `awaiting_approval`, `approved`, `published` | Tata kelola manusia, hak aksi, versi, dan publikasi |
| `deadline_status` | `not_open`, `open`, `due_soon`, `late`, `locked`, `exception_active` | Kondisi waktu terhadap jendela aktivitas dan pengecualian |

`deadline_status` sebaiknya dihitung dari waktu server, kebijakan periode, dan pengecualian aktif agar tidak menjadi data kedaluwarsa. Dengan pemisahan ini, misalnya dokumen yang sudah `submitted` tetap dapat mengalami retry parser tanpa kembali menjadi draft, dan `approved` dapat menjadi `late` tanpa mengubah keputusan persetujuan.

## Titik ekstensi kode

| Lokasi | Tanggung jawab dan cara memperluas |
|---|---|
| `src/app/admin/page.tsx` | Boundary server untuk autentikasi, profil, dan role nyata. Muat data awal di sini atau lewat service server-side; jangan percaya role dari client. |
| `src/app/admin/dashboard-app.tsx` | Komposisi UI serta state preview/navigasi. Saat modul mendapat backend nyata, ekstrak layar fitur tanpa memindahkan aturan otorisasi ke client. |
| `src/app/admin/rps-authoring-panel.tsx` | Enam langkah Level 2, unduhan template, pemeriksaan file lokal awal, serta inspector rules-only. |
| `src/app/admin/dashboard.module.css` | Token visual, shell, komponen, dan breakpoint. Ubah tema dari token terlebih dahulu agar layar tetap konsisten. |
| `src/lib/mvp/types.ts` | Kontrak role, navigasi, metrik, status, dan fixture. Tambahkan tipe domain di sini sebelum menambah bentuk data baru. |
| `src/lib/mvp/data.ts` | Satu sumber fixture, konfigurasi peran/menu, status processing, serta proyeksi RPS publik. Ganti bertahap dengan adapter query tanpa mengubah kontrak tampilan. |
| `src/lib/mvp/rps-authoring.ts` | Contoh data kanonik dan validator deterministik yang fail closed untuk identity, key, relasi, coverage, bobot, kebijakan pertemuan, referensi, dan pemisahan aktor. |
| `src/lib/rps/template-manifest.{json,ts}` | Kontrak immutable format DOCX, mapping bagian, gate workflow, policy dependency, dan batas keputusan AI/manusia. |
| `src/app/admin/actions.ts` | Aksi server; saat ini hanya keluar. Tambahkan command bisnis tervalidasi dan tercatat audit, bukan mutasi langsung dari komponen. |
| `src/app/api/uploads/sign`, `src/app/api/documents/parse`, `src/app/api/ai/extract` | Fondasi upload, parser, dan AI yang nanti dihubungkan ke workspace RPS. |
| `supabase/migrations/` | Setiap perubahan role, periode, assignment, workflow, versi, review, dan RLS harus berupa migration baru; jangan mengubah migration lama yang sudah diterapkan. |

Pertahankan data/config terpisah dari renderer. Hindari percabangan role yang tersebar; resolver kapabilitas harus menghasilkan menu dan aksi yang diizinkan dari satu kontrak.

## Batas implementasi saat ini

- Route `/admin` masih hanya menerima `superadmin`; lima peran di dalam dashboard adalah preview fixture.
- Isi kartu, tabel, kalender, health service, audit, notifikasi, dan workflow belum dibaca atau disimpan ke database. Seluruh nama/angka/status pada modul adalah contoh sintetis; refresh mengembalikan state interaksi.
- `platform_roles` baru mengenal `superadmin`; `organization_members` hanya satu role per pengguna/organisasi dan belum memiliki scope prodi maupun role mahasiswa.
- Belum ada entitas periode akademik, jendela workflow, kelas penawaran, penugasan dosen, enrollment mahasiswa, review, publikasi, atau pengecualian lock.
- Parser/AI memiliki endpoint fondasi, tetapi metrik dan tombol dashboard belum terhubung ke job nyata.
- `audit_logs` sudah tersedia, tetapi feed MVP masih fixture.
- IF306 adalah contoh workspace Level 2/4 lengkap; mata kuliah lain menampilkan ringkasan yang konsisten dan sengaja tidak mendaur ulang CPMK/bukti IF306.
- Validasi struktur RPS pada contoh IF306 sudah dihitung deterministik di client dan memiliki negative unit test, tetapi belum menjadi transaksi persisten. Rekomendasi, attainment, ekspor terisi, diff versi, review, pengesahan, dan corrective action masih representasi/simulasi UX. Evaluasi yang tampil merupakan fixture historis read-only karena jendela periode aktif belum dibuka.
- Template DOCX kosong tersaji sebagai aset publik byte-for-byte; file RPS yang dipilih pengguna hanya diperiksa ekstensi, ukuran, dan signature ZIP secara lokal, lalu tidak diunggah atau diproses.
- Belum ada RLS per kapabilitas dan belum ada perlindungan konflik seperti self-review/self-approval.

## Checklist validasi PR

- `npm run typecheck`, seluruh unit test yang tersedia, dan `npm run build` lulus.
- Pengguna anonim ditolak dari `/admin`; superadmin aktif dapat masuk dan keluar.
- Pergantian preview selalu mengatur ulang layar ke menu yang sah bagi peran tersebut.
- Menu Admin/Kaprodi/GPM/Dosen/Mahasiswa sesuai matriks kapabilitas; menu sistem tidak bocor ke non-Admin.
- Tiga progres `RPS`, `Pelaksanaan`, dan `Evaluasi` tidak digabung menjadi satu status.
- Submenu Dosen tetap terbuka, hanya child aktif memakai `aria-current`, dan deep-link/back-forward mempertahankan course + tahap yang valid.
- Checksum template publik sama dengan manifest/sumber; perubahan byte, urutan bagian, default angka universal, atau pelonggaran batas AI/human decision menggagalkan test kontrak.
- Semua screen, filter, tab, toggle, keputusan lokal, dan tombol simulasi tidak memicu error console/hydration.
- Navigasi keyboard, focus visible, label kontrol, kontras status, reduced motion, tabel overflow, dan drawer mobile diperiksa.
- Uji lebar minimal 360 px, tablet, desktop, serta zoom 200%; tidak ada aksi utama yang hilang.
- Fixture tidak memuat secret atau data pribadi nyata; tampilan mahasiswa tidak menampilkan data internal.
- Label fixture/preview jelas agar pengguna tidak mengira mutasi sudah tersimpan.

## Risiko QA yang perlu diantisipasi

- Selector preview tampak seperti penggantian role nyata sehingga mudah disalahartikan sebagai celah RBAC.
- Satu komponen dashboard yang besar berisiko menghasilkan state navigasi/tab yang tidak sinkron saat konfigurasi berubah.
- Banyak tabel dan kartu dari Level 2–4 dapat menyebabkan overflow serta kepadatan tinggi pada mobile dan zoom besar.
- Status berwarna tanpa teks, tombol demo tanpa hasil persisten, atau aksi placeholder dapat menurunkan aksesibilitas dan kejelasan MVP.
- Data fixture yang tidak konsisten antar-KPI, tabel, dan workflow dapat memberi kesan perhitungan bisnis sudah benar.
- Build dapat lulus tetapi RLS tetap terlalu luas; pengujian akses negatif wajib dilakukan setelah backend role ditambahkan.
- Metrik attainment Level 4 berisiko salah karena bobot, pembulatan, threshold, kelas kosong, atau asesmen tanpa mapping.

## Migrasi menuju versi persisten

1. Tambahkan migration untuk multi-role berscope, prodi, periode, workflow window, course offering, teaching assignment, dan enrollment.
2. Pisahkan tiga status, tambahkan version/review/publication/unlock request, lalu migrasikan nilai `status` lama secara eksplisit.
3. Bangun resolver kapabilitas server-side dan RLS; sertakan tes akses positif dan negatif untuk setiap role/scope/assignment.
4. Ganti preview dengan role context milik pengguna dan ganti fixture melalui repository/query adapter.
5. Implementasikan command workflow transaksional: submit, review, revisi, approve, publish, exception, dan audit immutable.
6. Hubungkan upload/parser/AI ke status job nyata; rules-only dan input manual tetap tersedia saat AI/parser gagal.
7. Persistensikan editor Level 2 dan versioning, lalu analitik program Level 3 serta evidence/attainment Level 4.
8. Buat projection mahasiswa yang hanya membaca versi efektif, kemudian ekspor PDF dan notifikasi perubahan.
9. Tambahkan E2E workflow lintas peran, uji deadline/timezone, observability, dan rekonsiliasi metrik sebelum produksi.
