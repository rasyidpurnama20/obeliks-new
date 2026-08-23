# Mekanisme Template RPS OBE

Dokumen resmi yang digunakan aplikasi adalah
`public/templates/Template_RPS_OBE_Format_Lengkap.docx`. Berkas tersebut disalin
apa adanya dari unggahan pengguna. Kontrak aplikasi berada di
`src/lib/rps/template-manifest.json`, sedangkan UI mengimpornya melalui export
`rpsTemplateManifest` dari `src/lib/rps/template-manifest.ts`.

## Integritas sumber

| Properti | Nilai |
| --- | --- |
| Nama berkas | `Template_RPS_OBE_Format_Lengkap.docx` |
| Versi template | `1.0.0` |
| Halaman | 12 |
| Tabel | 22 |
| Ukuran | 65.470 byte |
| SHA-256 | `4708bba1e1d7f5ecf6780d41093ec9726e88b0bb064dad39aa3f546f05876c2b` |
| URL unduhan | `/templates/Template_RPS_OBE_Format_Lengkap.docx` |
| Model input | Placeholder di dalam tabel, bukan Word content control |

Checksum, ukuran, signature ZIP/DOCX, nama berkas, serta kontrak manifest diuji
oleh `npm run test:rps-template`. Perubahan sekecil apa pun pada berkas harus
disertai versi baru, checksum baru, pemetaan manifest yang ditinjau ulang, dan
catatan migrasi. Jangan mengganti berkas pada URL yang sama secara diam-diam.

Salinan publik dipertahankan byte-for-byte, sehingga metadata dokumen sumber
juga tetap ada. Jika kebijakan privasi mengharuskan sanitasi metadata, terbitkan
versi baru dengan nama, checksum, dan catatan migrasi baru—jangan menimpa versi
ini secara diam-diam.

## Urutan data dan form

Urutan 12 bagian di manifest mengikuti dokumen, dari identitas di halaman 1
hingga pengesahan di halaman 12. Bagian-bagian tersebut dipetakan ke enam langkah
form yang lebih ringkas:

1. Identitas Mata Kuliah
2. Capaian Pembelajaran
3. Alignment OBE
4. Asesmen & Metode
5. Rencana Mingguan
6. Validasi & Pengesahan

Setiap bagian memiliki `requiredFields`, `pageRange`, dan `workflowStepId` agar
renderer form, importer/parser, validator, dan exporter membaca kontrak yang
sama. ID entitas harus stabil dalam satu versi RPS. Semua relasi CPL → CPMK →
Sub-CPMK → pertemuan → asesmen → bukti menggunakan foreign key yang dapat
ditelusuri; label tampilan tidak boleh dipakai sebagai key.

Tabel 8–13 dan 17–18 adalah proyeksi turunan dari data kanonik. Nilainya dihitung
dari jadwal, asesmen, mapping, dan hasil capaian; pengguna tidak mengedit salinan
angka yang sama di beberapa tabel. Importer/exporter harus berhenti (fail closed)
ketika checksum atau signature struktur template tidak dikenal, bukan menebak
posisi placeholder pada versi yang berbeda.

## Alur status

1. Dosen membuat draf atau mengimpor DOCX dan menyelesaikan data terstruktur.
2. Sistem menjalankan gate deterministik dan menampilkan rule ID beserta bukti
   yang gagal. Sistem tidak menilai mutu narasi atau identitas orang.
3. Setelah semua gate submit lulus, dosen mengirim versi immutable kepada GPM.
4. GPM menelaah dan mencatat keputusan serta catatan. GPM tidak dapat menjadi
   penyusun untuk versi yang sama.
5. Kaprodi dapat mengesahkan hanya setelah telaah GPM. Actor penyusun, penelaah,
   dan penyetuju harus berbeda.
6. Mahasiswa hanya melihat versi yang telah disahkan dan dipublikasikan.
7. Revisi setelah submit selalu membuat versi baru dengan riwayat perubahan;
   keputusan lama tidak ditimpa.

Admin mengelola akun, periode, dan kebijakan, tetapi tidak dapat menyetujui isi
akademik. Sistem harus menyimpan actor ID, role, timestamp, rule evidence, policy
ID, dan versi RPS pada setiap transisi.

## Gate validasi

| Gate | Pemeriksaan | Sumber nilai |
| --- | --- | --- |
| Field wajib | Path wajib terisi | Manifest bagian |
| Key unik | ID/kode tidak duplikat | Versi RPS |
| Foreign key | Semua relasi menemukan induk | Versi RPS |
| Hierarki outcome | CPMK→CPL dan Sub-CPMK→CPMK lengkap | Versi RPS |
| Jumlah pertemuan | Sama dengan `expectedMeetingCount` | Kebijakan prodi-periode efektif |
| Bobot asesmen | Jumlah bobot tepat 100% | Versi RPS |
| Cakupan asesmen | Setiap CPMK memiliki asesmen dan bukti | Versi RPS |
| Kebijakan efektif | Scope dan rentang tanggal cocok | Kebijakan prodi-periode |
| Urutan persetujuan | Dosen → GPM → Kaprodi | Event workflow |
| Pemisahan tugas | Tidak ada self-approval | Actor ID workflow |

Format unggahan menyediakan susunan tabel 16 pertemuan, tetapi angka 16 bukan
aturan universal aplikasi. Jumlah pertemuan, keberadaan milestone seperti UTS
atau UAS, dan ambang ketercapaian harus berasal dari kebijakan prodi-periode yang
memiliki `effectiveFrom` dan `effectiveUntil`. Kontrak sengaja tidak mempunyai
nilai default universal untuk ketiganya.

## Guard netralitas dan AI

Setiap rule juga menyatakan transisi yang diblokir: `submit-for-review` untuk
kelengkapan rancangan, `publish-rps` untuk pengesahan, atau `close-evaluation`
untuk hasil pelaksanaan. Data ketercapaian dan tindak lanjut tidak menghalangi
pengajuan RPS sebelum semester dimulai; data tersebut baru wajib saat evaluasi
mata kuliah ditutup.

Validator hanya boleh membaca struktur dokumen, ID/relasi, total numerik,
kebijakan yang berlaku, dan event workflow. Agama, etnis, ras, gender,
disabilitas, usia, status perkawinan, afiliasi politik, dan status ekonomi tidak
boleh menjadi input validasi atau pengesahan.

AI bersifat bantuan opsional: boleh memberi saran draf dengan alasan dan sumber,
tetapi tidak boleh menyetujui/menolak RPS, memberi nilai, mengubah kebijakan, atau
menerapkan perubahan tanpa penerimaan eksplisit manusia. Gate deterministik
mengurangi ruang keputusan yang tidak konsisten; keputusan akademik tetap milik
GPM dan Kaprodi dengan audit trail.

## Batas MVP

Template tersimpan dan bisa diunduh langsung dari aplikasi. Manifest sudah siap
dipakai UI dan backend sebagai kontrak bersama. Parser DOCX yang mengubah
placeholder tabel menjadi data terstruktur masih harus memvalidasi ulang hasil
ekstraksi terhadap rule yang sama; keberhasilan upload atau ekstensi `.docx`
sendiri tidak berarti isi RPS valid.

UI MVP sengaja belum memanggil upload, parser, atau AI produksi. Aktivasi backend
harus didahului pemeriksaan assignment dosen, ownership dokumen, role, ruang
lingkup mata kuliah, lock periode, MIME/magic OOXML, serta RLS dan negative test
lintas pengguna. Dokumen RPS terisi wajib berada di storage privat; hanya template
kosong ini yang boleh disajikan sebagai aset publik.
