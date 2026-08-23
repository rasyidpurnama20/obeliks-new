# Snapshot Data Publik S-1 Informatika UNDIP

Snapshot ini diambil pada **23 Agustus 2026** untuk kebutuhan MVP OBELIKS. Data mesin yang menjadi sumber seed tersedia di [`data/if-undip/public-snapshot.json`](../data/if-undip/public-snapshot.json).

## Sumber dan batas verifikasi

| Data | Sumber resmi | Status |
|---|---|---|
| Dosen | [Profil Dosen IF UNDIP](https://if.undip.ac.id/profil-dosen/) | 30 homebase dan 6 dosen pengampu terbaca lengkap |
| Email dosen | Direktori/profil publik pada domain UNDIP; URL per orang tersimpan di JSON | 33 alamat institusi dipublikasikan, 3 belum ditemukan; status mailbox belum dikonfirmasi |
| Mata kuliah | [Kurikulum IF UNDIP](https://if.undip.ac.id/kurikulum/) | Kurikulum 2024 OBE dipakai sebagai katalog aktif |
| CPL | [Capaian Pembelajaran Lulusan](https://if.undip.ac.id/capaian-pembelajaran-lulusan/) | 12 pernyataan tersedia; kode `CPL-01`–`CPL-12` adalah ID internal OBELIKS |
| Silabus | [Halaman Silabus](https://if.undip.ac.id/silabus/) dan [dokumen tertaut](https://drive.google.com/file/d/1gd-xuZFM1plxkh10maKtU9PUjPyrShQ3/view?usp=sharing) | Pratinjau 36 halaman berlabel Kurikulum 2020 berisi materi dan referensi |

Data berikut **tidak dipublikasikan secara lengkap** pada sumber di atas dan tidak boleh ditebak:

- email institusi untuk 3 dari 36 dosen serta username non-email;
- penugasan dosen ke mata kuliah atau kelas pada periode tertentu;
- CPMK, Sub-CPMK, dan matriks CPMK–CPL;
- matriks CPL–mata kuliah;
- jumlah kelas, peserta, dan tahun ajaran penawaran mata kuliah.

Bidang keahlian dosen dan daftar topik silabus tidak digunakan untuk menebak penugasan atau CPMK. Dokumen silabus memang memuat beberapa kalimat berbentuk kemampuan, tetapi bagian tersebut tetap diberi label `Materi`, bukan `CPMK`.

Halaman CPL menyebut dokumen kurikulum tahun 2022, sedangkan katalog mata kuliah aktif berlabel 2024 OBE. Sampai prodi memberi dokumen penghubung resmi, OBELIKS menyimpan keduanya sebagai sumber berbeda dan tidak membentuk matriks lintas versi.

## Implikasi untuk MVP yang lebih sederhana

MVP cukup memakai satu alur: **Admin menyiapkan data dan penugasan → Dosen menyusun RPS → GPM/Kaprodi meninjau → Mahasiswa melihat RPS terbit**. Tidak perlu membangun mesin kebijakan, AI, parser, dan analitik kompleks terlebih dahulu.

1. Import 36 profil dosen, katalog 2024 OBE, dan 12 CPL sebagai data master.
2. Admin melengkapi tiga email yang belum tersedia, mengonfirmasi kepemilikan mailbox, serta menetapkan dosen–mata kuliah; aplikasi tidak membuat relasi tersebut dari keahlian.
3. Dosen mengisi enam bagian RPS dari satu layar dan menggunakan template DOCX resmi.
4. Validasi awal hanya memeriksa kelengkapan, relasi CPL–CPMK, bobot asesmen, serta rencana pertemuan.
5. GPM memberi catatan, Kaprodi menerbitkan, mahasiswa hanya membaca versi terbit.

## Dosen

NIP disimpan sebagai string karena tiga identitas memakai awalan `H.7.`. Semua 36 entri menjadi kandidat akun, tetapi provisi bersifat atomik pada tingkat validasi: tidak berjalan sebelum setiap NIP memiliki email institusi yang dikonfirmasi admin. Alamat berstatus `Dipublikasikan` berarti alamat itu ditemukan pada laman UNDIP, bukan bukti bahwa mailbox masih aktif.

### Email institusi yang dipublikasikan

| NIP | Nama | Email institusi publik | Status/sumber |
|---|---|---|---|
| `198203092006041002` | Adi Wibowo | `bowo.adi@live.undip.ac.id` | [Dipublikasikan UNDIP](https://scholar.undip.ac.id/en/persons/adi-wibowo/) |
| `197404011999031002` | Aris Puji Widodo | — | Belum ditemukan; wajib verifikasi Admin |
| `197601102009122002` | Dinar Mutiara Kusumo Nugraheni | `dinar.mutiara@live.undip.ac.id` | [Dipublikasikan UNDIP](https://ejournal.undip.ac.id/index.php/jmasif/article/download/41761/20622) |
| `197108111997021004` | Aris Sugiharto | `arissugiharto@lecturer.undip.ac.id` | [Direktori resmi UNDIP](https://if.fsm.undip.ac.id/en/struktur-organisasi) |
| `198104202005012001` | Retno Kusumaningrum | `retno@lecturer.undip.ac.id` | [Direktori resmi UNDIP](https://if.fsm.undip.ac.id/en/struktur-organisasi) |
| `197905242009121003` | Sutikno | `sutikno@lecturer.undip.ac.id` | [Direktori resmi UNDIP](https://if.fsm.undip.ac.id/en/struktur-organisasi) |
| `196511071992031003` | Eko Adi Sarwoko | `ekoadisarwoko@lecturer.undip.ac.id` | [Direktori resmi UNDIP](https://if.fsm.undip.ac.id/en/struktur-organisasi) |
| `197007051997021001` | Priyo Sidik Sasongko | `priyosidiksasongko@lecturer.undip.ac.id` | [Direktori resmi UNDIP](https://if.fsm.undip.ac.id/en/struktur-organisasi) |
| `197308291998022001` | Beta Noranita | `betanoranita@lecturer.undip.ac.id` | [Direktori resmi UNDIP](https://if.fsm.undip.ac.id/en/struktur-organisasi) |
| `198009142006041002` | Edy Suharto | `edys@lecturer.undip.ac.id` | [Direktori resmi UNDIP](https://if.fsm.undip.ac.id/en/struktur-organisasi) |
| `198404112019031009` | Fajar Agung Nugroho | `fajar@lecturer.undip.ac.id` | [Direktori resmi UNDIP](https://if.fsm.undip.ac.id/en/struktur-organisasi) |
| `198012272015041002` | Guruh Aryotejo | `guruh@lecturer.undip.ac.id` | [Direktori resmi UNDIP](https://if.fsm.undip.ac.id/en/struktur-organisasi) |
| `197805162003121001` | Helmie Arif Wibawa | `helmie@lecturer.undip.ac.id` | [Direktori resmi UNDIP](https://if.fsm.undip.ac.id/en/struktur-organisasi) |
| `197902122008121002` | Indra Waspada | `indrawaspada@lecturer.undip.ac.id` | [Direktori resmi UNDIP](https://if.fsm.undip.ac.id/en/struktur-organisasi) |
| `198903032015042002` | Khadijah | `khadijah@lecturer.undip.ac.id` | [Direktori resmi UNDIP](https://if.fsm.undip.ac.id/en/struktur-organisasi) |
| `198106202015041002` | Muhammad Malik Hakim | `muhammadmalikhakim@lecturer.undip.ac.id` | [Direktori resmi UNDIP](https://if.fsm.undip.ac.id/en/struktur-organisasi) |
| `197907202003121002` | Nurdin Bahtiar | `nurdinbahtiar@lecturer.undip.ac.id` | [Direktori resmi UNDIP](https://if.fsm.undip.ac.id/en/struktur-organisasi) |
| `198803222020121010` | Prajanto Wahyu Adi | `prajanto@lecturer.undip.ac.id` | [Direktori resmi UNDIP](https://if.fsm.undip.ac.id/en/struktur-organisasi) |
| `198010212005011003` | Ragil Saputra | `ragilsaputra@lecturer.undip.ac.id` | [Direktori resmi UNDIP](https://if.fsm.undip.ac.id/en/struktur-organisasi) |
| `198511252018032001` | Rismiyati | `rismiyati@lecturer.undip.ac.id` | [Direktori resmi UNDIP](https://if.fsm.undip.ac.id/en/struktur-organisasi) |
| `198302032006041002` | Satriyo Adhy | `satriyo@undip.ac.id` | [Dipublikasikan UNDIP](https://ejournal3.undip.ac.id/index.php/joint/about/contact) |
| `197805022005012002` | Sukmawati Nur Endah | `sukmane@lecturer.undip.ac.id` | [Direktori resmi UNDIP](https://if.fsm.undip.ac.id/en/struktur-organisasi) |
| `199112092024061001` | Adhe Setya Pramayoga | `adhesetya@lecturer.undip.ac.id` | [Direktori resmi UNDIP](https://if.fsm.undip.ac.id/en/struktur-organisasi) |
| `199603032024061003` | Sandy Kurniawan | `sandy@lecturer.undip.ac.id` | [Direktori resmi UNDIP](https://if.fsm.undip.ac.id/en/struktur-organisasi) |
| `H.7.198806142022102001` | Yunila Dwi Putri Ariyanti | `yuniladwiputriariyan@lecturer.undip.ac.id` | [Direktori resmi UNDIP](https://if.fsm.undip.ac.id/en/struktur-organisasi); ejaan lokal sesuai sumber |
| `H.7.199204252023072001` | Yeva Fadhilah Ashari | `yeva@lecturer.undip.ac.id` | [Direktori resmi UNDIP](https://if.fsm.undip.ac.id/en/struktur-organisasi) |
| `H.7.199602212023072001` | Etna Vianita | `etnavianita02@lecturer.undip.ac.id` | [Direktori resmi UNDIP](https://if.fsm.undip.ac.id/en/struktur-organisasi) |
| `199606132024062001` | Dhena Kamalia Fu'adi | `dhenakamalia@lecturer.undip.ac.id` | [Direktori resmi UNDIP](https://if.fsm.undip.ac.id/en/struktur-organisasi) |
| `199612272024061001` | Henri Tantyoko | `henritantyoko@lecturer.undip.ac.id` | [Direktori resmi UNDIP](https://if.fsm.undip.ac.id/en/struktur-organisasi) |
| `199805212024061001` | Satriawan Rasyid Purnama | — | Belum ditemukan; wajib verifikasi Admin |
| `196902141994032002` | Widowati | `widowati@lecturer.undip.ac.id` | [Profil Matematika UNDIP](https://math.fsm.undip.ac.id/widowati/) |
| `197203171998021001` | Kusworo Adi | `kusworoadi@lecturer.undip.ac.id` | [Direktori Fisika UNDIP](https://fisika.fsm.undip.ac.id/v2/dosen/) |
| `196307061991021001` | Tarno | `tarno@lecturer.undip.ac.id` | [Profil Statistika UNDIP](https://stat.fsm.undip.ac.id/v1/prof-dr-tarno-m-si/) |
| `196405181992031002` | Catur Edi Widodo | `caturediwidodo@lecturer.undip.ac.id` | [Direktori Fisika UNDIP](https://fisika.fsm.undip.ac.id/v2/dosen/) |
| `196502251992011001` | Rukun Santoso | — | Belum ditemukan; profil resmi hanya memuat email noninstitusi |
| `196511231994031003` | Rahmat Gernowo | `rahmatgernowo@lecturer.undip.ac.id` | [Direktori Fisika UNDIP](https://fisika.fsm.undip.ac.id/v2/dosen/) |

### Profil dan kepakaran

| Kelompok | Nama sesuai sumber | NIP | Keahlian/kepakaran | Verifikasi |
|---|---|---|---|---|
| Homebase | Dr.Eng. Adi Wibowo, S.Si., M.Kom. | `198203092006041002` | DNA Nanotechnology, Robotics, Artificial Intelligence | Terverifikasi |
| Homebase | Dr. Aris Puji Widodo, S.Si., M.T. | `197404011999031002` | Rekayasa Perangkat Lunak dan e-Government | Terverifikasi |
| Homebase | Dinar Mutiara Kusumo Nugraheni, S.T., M.InfoTech.(Comp)., Ph.D. | `197601102009122002` | Information Technology Computing | Terverifikasi |
| Homebase | Dr. Aris Sugiharto, S.Si., M.Kom. | `197108111997021004` | Pattern Recognition | Terverifikasi |
| Homebase | Dr. Retno Kusumaningrum, S.Si., M.Kom. | `198104202005012001` | Computer Vision, Pattern Recognition, Natural Language Processing, Topic Modelling, Machine Learning | Terverifikasi |
| Homebase | Dr. Sutikno, S.T., M.Cs. | `197905242009121003` | Machine Learning, Computer Vision, dan Artificial Intelligence | Terverifikasi |
| Homebase | Drs. Eko Adi Sarwoko, M.Komp. | `196511071992031003` | Computer Science | Terverifikasi |
| Homebase | Priyo Sidik Sasongko, S.Si., M.Kom. | `197007051997021001` | Komputasi Cerdas | Terverifikasi |
| Homebase | Beta Noranita, S.Si., M.Kom. | `197308291998022001` | Sistem Informasi | Terverifikasi |
| Homebase | Edy Suharto, S.T., M.Kom | `198009142006041002` | Rekayasa Perangkat Lunak | Terverifikasi |
| Homebase | Fajar Agung Nugroho, S.Kom., M.Cs. | `198404112019031009` | Teknologi Informasi | Terverifikasi |
| Homebase | Guruh Aryotejo, S.Kom., M.Sc. | `198012272015041002` | Teknologi Informasi | Terverifikasi |
| Homebase | Dr. Helmie Arif Wibawa, S.Si., M.Cs. | `197805162003121001` | Pengenalan Pola, Computer Vision, Artificial Intelligence | Terverifikasi |
| Homebase | Dr. Indra Waspada, S.T., M.TI | `197902122008121002` | Teknologi Informasi | Terverifikasi |
| Homebase | Khadijah, S.Kom., M.Cs. | `198903032015042002` | Sistem Cerdas Terapan | Terverifikasi |
| Homebase | Muhammad Malik Hakim, S.T., M.T.I. | `198106202015041002` | Teknologi Informasi | Terverifikasi |
| Homebase | Nurdin Bahtiar, S.Si., M.T. | `197907202003121002` | Sistem Informasi, Data Mining | Terverifikasi |
| Homebase | Prajanto Wahyu Adi, M.Kom. | `198803222020121010` | Pengolahan Citra, Watermarking, Klasifikasi | Terverifikasi |
| Homebase | Ragil Saputra, S.Si., M.Cs. | `198010212005011003` | Sistem Informasi | Terverifikasi |
| Homebase | Rismiyati, B.Eng, M.Cs | `198511252018032001` | Sistem Cerdas | Terverifikasi |
| Homebase | Satriyo Adhy, S.Si., M.T. | `198302032006041002` | Sistem Informasi | Terverifikasi |
| Homebase | Sukmawati Nur Endah, S.Si., M.Kom. | `197805022005012002` | Kecerdasan Buatan | Terverifikasi |
| Homebase | Adhe Setya Pramayoga, M.T. | `199112092024061001` | Rekayasa Perangkat Lunak dan Data | Terverifikasi |
| Homebase | Sandy Kurniawan, S.Kom., M.Kom. | `199603032024061003` | Kecerdasan Buatan | Terverifikasi |
| Homebase | Yunila Dwi Putri Ariyanti, S.Kom., M.Kom. | `H.7.198806142022102001` | Rekayasa Perangkat Lunak | Perlu tinjau: versi Inggris berbeda |
| Homebase | Dr. Yeva Fadhilah Ashari, S.Si., M.Si. | `H.7.199204252023072001` | Teori Graf dan Aplikasinya, Kombinatorika | Terverifikasi |
| Homebase | Etna Vianita, S.Mat., M.Mat. | `H.7.199602212023072001` | Matematika | Terverifikasi |
| Homebase | Dhena Kamalia Fu'adi, S.Kom., M.Kom. | `199606132024062001` | Sistem Teknologi Informasi | Terverifikasi |
| Homebase | Henri Tantyoko, S.Kom., M.Kom. | `199612272024061001` | Kecerdasan Buatan, NLP | Terverifikasi |
| Homebase | Satriawan Rasyid Purnama, S.Kom., M.Cs. | `199805212024061001` | Kecerdasan Buatan, Pembelajaran Mesin | Perlu tinjau: versi Inggris berbeda |
| Pengampu | Prof. Dr. Widowati, S.Si., M.Si. | `196902141994032002` | Pemodelan Matematika dan Sistem Kendali | Terverifikasi |
| Pengampu | Prof. Dr. Kusworo Adi, S.Si., M.T. | `197203171998021001` | Fisika Instrumentasi | Terverifikasi |
| Pengampu | Prof. Dr. Drs. Tarno, M.Si. | `196307061991021001` | Time Series Analysis | Terverifikasi |
| Pengampu | Prof. Dr. Drs. Catur Edi Widodo, M.T. | `196405181992031002` | Fisika Komputasi | Terverifikasi |
| Pengampu | Prof. Dr. Drs. Rukun Santoso, M.Si. | `196502251992011001` | Komputasi Statistika | Terverifikasi |
| Pengampu | Prof. Dr. Rahmat Gernowo, M.Si. | `196511231994031003` | Fisika Atmosfer | Terverifikasi |

## CPL

Halaman sumber menampilkan urutan 1–12 tanpa kode. OBELIKS memberi ID internal `CPL-01`–`CPL-12` agar relasi data stabil; ID ini bukan kode resmi dari IF UNDIP.

| ID internal | Pernyataan sesuai sumber |
|---|---|
| `CPL-01` | Mampu menerapkan dan menunjukkan tanggung jawab profesional berdasarkan nilai ketakwaan kepada Tuhan Yang Maha Esa dan nilai kemanusiaan. |
| `CPL-02` | Mampu menerapkan dan menunjukkan nilai, norma, etika akademik, prinsip keberagaman pendapat dan budaya, serta kepedulian sosial dalam berkolaborasi. |
| `CPL-03` | Mampu melaksanakan prinsip nasionalisme, taat hukum, dan menunjukkan sikap disiplin dalam memajukan kehidupan bermasyarakat dan bernegara berdasarkan Pancasila. |
| `CPL-04` | Mampu menerapkan prinsip kemandirian dan kewirausahaan dalam bidang informatika serta melakukan evaluasi secara bermutu dan terukur. |
| `CPL-05` | Mampu menerapkan konsep teoretis bidang ilmu komputer dalam mengidentifikasi solusi permasalahan kompleks dengan prinsip komputasi dan ilmu lain yang relevan. |
| `CPL-06` | Mampu menerapkan pemikiran analitis berbasis data untuk memformulasikan penyelesaian permasalahan kompleks untuk suatu organisasi. |
| `CPL-07` | Mampu menerapkan konsep sistem dan pengembangan perangkat lunak untuk menghasilkan solusi atas permasalahan kompleks di berbagai bidang dengan mempertimbangkan aspek keamanan. |
| `CPL-08` | Mampu menerapkan pemikiran logis, kritis, sistematis, dan inovatif dalam mengkaji implikasi pengembangan hasil riset bidang Informatika terkini sebagai educator pembelajar sepanjang hayat. |
| `CPL-09` | Mampu membangun dan mempraktekan komunikasi secara efektif, bekerja sama dan kolaborasi, dan menerapkan nilai kepemimpinan. |
| `CPL-10` | Mampu menghasilkan rancangan, mengimplementasikan, dan mengevaluasi solusi berbasis algoritma dengan mempertimbangkan aspek kompleksitas. |
| `CPL-11` | Mampu menghasilkan rancangan, mengimplementasikan, dan mengevaluasi solusi berbasis komputasi cerdas. |
| `CPL-12` | Mampu menghasilkan rancangan dan mengimplementasikan solusi manajemen informasi dengan pendekatan data analytics. |

## Kurikulum 2024 OBE

Katalog memiliki 83 kode: 53 kode wajib, 12 pilihan semester ganjil, dan 18 pilihan semester genap. Tujuh kode pendidikan agama merupakan alternatif dalam satu slot; karena itu beban wajib mahasiswa tidak dihitung dengan menjumlahkan ketujuh alternatif.

### Mata kuliah wajib

| Semester | Kode | Mata kuliah | SKS | Catatan |
|---:|---|---|---:|---|
| 1 | `MIK1624101` | Dasar Sistem | 3 | |
| 1 | `MIK1624102` | Dasar Pemrograman | 3 | |
| 1 | `MIK1624103` | Struktur Diskret | 4 | |
| 1 | `MIK1624104` | Matematika I | 2 | |
| 1 | `MIK1624105` | Aljabar Linier | 3 | |
| 1 | `UUW1624002` | Pancasila | 2 | |
| 1 | `UUW1624107` | Bahasa Inggris I | 1 | |
| 1 | `UUW1624004` | Bahasa Indonesia | 2 | |
| 2 | `MIK1624201` | Organisasi dan Arsitektur Komputer | 3 | |
| 2 | `MIK1624202` | Algoritma dan Pemrograman | 4 | |
| 2 | `MIK1624203` | Statistika | 2 | |
| 2 | `MIK1624204` | Matematika II | 2 | |
| 2 | `MIK1624205` | Metode Numerik | 3 | |
| 2 | `UUW1624003` | Kewarganegaraan | 2 | |
| 2 | `UUW1624207` | Bahasa Inggris II | 1 | |
| 2 | `UUW1624005` | Olah Raga | 1 | |
| 2 | `UUW1624011` | Pendidikan Agama Islam | 2 | Alternatif agama |
| 2 | `UUW1624021` | Pendidikan Agama Kristen | 2 | Alternatif agama |
| 2 | `UUW1624031` | Pendidikan Agama Katolik | 2 | Alternatif agama |
| 2 | `UUW1624041` | Pendidikan Agama Hindu | 2 | Alternatif agama |
| 2 | `UUW1624051` | Pendidikan Agama Budha | 2 | Alternatif agama |
| 2 | `UUW1624061` | Pendidikan Agama Kong Hu Chu | 2 | Alternatif agama |
| 2 | `UUW1624071` | Kepercayaan Kepada Tuhan YME | 2 | Alternatif agama |
| 3 | `MIK1624301` | Sistem Operasi | 3 | |
| 3 | `MIK1624302` | Struktur Data | 4 | |
| 3 | `MIK1624303` | Basis Data | 4 | |
| 3 | `MIK1624304` | Rekayasa Perangkat Lunak | 3 | |
| 3 | `MIK1624305` | Teori Bahasa dan Otomata | 3 | |
| 3 | `UUW1624307` | Bahasa Inggris III | 1 | |
| 4 | `MIK1624402` | Pemrograman Berorientasi Objek | 3 | |
| 4 | `MIK1624403` | Manajemen Basis Data | 3 | |
| 4 | `MIK1624406` | Grafik dan Teknik Interaktif | 3 | |
| 4 | `MIK1624405` | Kecerdasan Buatan | 3 | |
| 4 | `MIK1624404` | Analisis dan Strategi Algoritma | 3 | |
| 4 | `MIK1624401` | Jaringan Komputer | 3 | |
| 5 | `MIK1624501` | Komputasi Tersebar dan Paralel | 3 | |
| 5 | `MIK1624502` | Pengembangan Platform Khusus | 4 | |
| 5 | `MIK1624503` | Sistem Informasi | 3 | |
| 5 | `MIK1624504` | Proyek Perangkat Lunak | 3 | |
| 5 | `MIK1624505` | Pembelajaran Mesin | 3 | |
| 5 | `MIK1624506` | Probabilitas Diskret | 2 | |
| 6 | `MIK1624601` | Keamanan dan Jaminan Informasi | 3 | |
| 6 | `MIK1624602` | Uji Perangkat Lunak | 3 | |
| 6 | `MIK1624603` | Interaksi Manusia Komputer | 3 | |
| 6 | `MIK1624604` | Manajemen Proyek | 3 | |
| 6 | `MIK1624605` | Analitika Data | 3 | |
| 6 | `MIK1624606` | Praktik Kerja Lapangan | 3 | |
| 7 | `MIK1624701` | Metodologi dan Penulisan Ilmiah | 2 | |
| 7 | `MIK1624702` | Masyarakat dan Etika Profesi | 2 | |
| 7 | `UUW1624006` | Internet of Things | 2 | |
| 7 | `UUW1624008` | Kewirausahaan | 2 | |
| 7 | `UUW1624009` | Kuliah Kerja Nyata | 3 | |
| 8 | `MIK1624899` | Tugas Akhir | 6 | |

### Mata kuliah pilihan semester ganjil

| Kode | Mata kuliah | SKS |
|---|---|---:|
| `MIK1624703` | Topik Khusus Rekayasa Perangkat Lunak, Sistem dan Teknologi Informasi | 3 |
| `MIK1624704` | Topik Khusus Kecerdasan Buatan, Komputasi dan Grafik | 3 |
| `MIK1624711` | Metode Perangkat Lunak | 3 |
| `MIK1624712` | Kualitas Perangkat Lunak | 3 |
| `MIK1624713` | Visualisasi Data | 3 |
| `MIK1624714` | Penambangan Data | 3 |
| `MIK1624715` | Sistem Tertanam | 3 |
| `MIK1624721` | Pemodelan dan Simulasi | 3 |
| `MIK1624722` | Visi Komputer | 3 |
| `MIK1624723` | Algoritma Evolusioner | 3 |
| `MIK1624724` | Komputasi Lunak | 3 |
| `MIK1624725` | Temu Balik Informasi | 3 |

### Mata kuliah pilihan semester genap

| Kode | Mata kuliah | SKS |
|---|---|---:|
| `MIK1624811` | Evolusi Perangkat Lunak | 3 |
| `MIK1624812` | Rekayasa Sistem | 3 |
| `MIK1624813` | Komputasi Awan | 3 |
| `MIK1624814` | Arsitektur Perangkat Lunak | 3 |
| `MIK1624815` | Pemrograman Lanjut | 3 |
| `MIK1624816` | Data Besar | 3 |
| `MIK1624817` | Intelijen Bisnis | 3 |
| `MIK1624818` | Rekayasa Data | 3 |
| `MIK1624819` | Sistem Enterprise | 3 |
| `MIK1624821` | Pengenalan Pola | 3 |
| `MIK1624822` | Kriptografi | 3 |
| `MIK1624823` | Bioinformatika | 3 |
| `MIK1624824` | Keamanan Siber | 3 |
| `MIK1624825` | Forensik Digital | 3 |
| `MIK1624826` | Robotika | 3 |
| `MIK1624827` | Penambangan Data | 3 |
| `MIK1624828` | Analisis Jaringan Sosial | 3 |
| `MIK1624829` | Sains Data | 3 |

## Aturan provisi akun dosen

Sumber publik menyediakan 33 dari 36 alamat institusi, tetapi tidak membuktikan mailbox masih aktif. Tiga alamat yang belum ditemukan harus diberikan Admin melalui secret; NIP tidak diubah menjadi alamat email dan nama tidak digunakan untuk menebak username.

- Seed memproses tepat 36 dosen: 30 homebase dan 6 dosen pengampu.
- Email publik pada snapshot dipakai sebagai nilai awal. `LECTURER_EMAIL_MAP_JSON` berisi tiga email yang belum tersedia dan/atau koreksi yang sudah diverifikasi Admin. Koreksi otomatis hanya berlaku selama akun masih berstatus onboarding; perubahan email akun aktif harus direkonsiliasi manual.
- Apply hanya berjalan jika `LECTURER_EMAILS_CONFIRMED=true`, sebagai konfirmasi eksplisit bahwa Admin telah memeriksa seluruh pemilik mailbox.
- Password awal dibaca dari secret `LECTURER_INITIAL_PASSWORD`; nilainya tidak disimpan di source, Markdown, log, atau workflow input.
- Akun yang sudah ada tidak pernah direset kembali ke password awal.
- Akun baru tetap `unconfirmed`, diblokir pada Supabase Auth, berprofil `suspended`, dan tanpa akses organisasi.
- Rerun memperbaiki provisi parsial dan koreksi email akun staging berdasarkan pasangan sumber+NIP, tetapi tidak mengubah akun yang onboarding-nya sudah selesai.
- Aktivasi harus memverifikasi mailbox, mengganti password, melepas blokir, mengaktifkan profil, menghapus flag onboarding, lalu menambahkan membership/penugasan yang benar.

Aturan ini mencegah alamat email hasil tebakan, pengambilalihan akun dengan password bersama, serta pemberian akses ke mata kuliah yang belum pernah dipublikasikan sebagai penugasan resmi.

Validasi lokal hanya membaca dataset dan koreksi email. Saat ini perintah sengaja gagal sampai tiga email yang belum tersedia dilengkapi:

```bash
LECTURER_EMAIL_MAP_JSON='<secret-json>' npm run seed:if-undip-lecturers
```

Provisi ke Supabase harus dijalankan secara sadar dengan seluruh secret tersedia:

```bash
LECTURER_EMAIL_MAP_JSON='<secret-json>' \
LECTURER_INITIAL_PASSWORD='<secret>' \
LECTURER_EMAILS_CONFIRMED=true \
LECTURER_ORGANIZATION_SLUG='informatika-undip' \
LECTURER_SEED_APPLY=true \
npm run seed:if-undip-lecturers
```

Workflow GitHub hanya menerima apply dari branch `main`. Environment `Production` juga harus dibatasi ke protected branch dan memakai reviewer sebelum secret dilepas.

Provisi hanya membuat akun onboarding yang diblokir, tidak memberi `organization_members`, dan tidak mencetak email atau password. Karena itu password awal saja tidak dapat dipakai untuk mengambil alih akun. Aktivasi serta penugasan tetap merupakan keputusan Admin setelah verifikasi identitas melalui mailbox institusi.
