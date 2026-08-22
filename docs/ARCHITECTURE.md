# Arsitektur OBELIKS

## Prinsip utama

1. **Gratis untuk mulai:** hanya GitHub, Vercel Hobby, dan Supabase Free yang wajib.
2. **AI tidak menjadi single point of failure:** rules engine tetap menghasilkan caution tanpa API key.
3. **Upload tidak melewati Vercel:** browser mengunggah langsung ke private Supabase Storage.
4. **Tidak terkunci Vercel:** aplikasi memakai runtime Node.js standar dan memiliki standalone Docker image.
5. **Tidak terkunci Supabase Cloud:** skema adalah PostgreSQL dan Supabase dapat dipindah ke Docker self-hosted.

## Stack per fase

| Lapisan | Fase gratis | Fase server sendiri |
|---|---|---|
| Web/API | Next.js di Vercel | Container Next.js yang sama |
| Database/Auth/Storage | Supabase Cloud Free | Self-hosted Supabase Docker |
| Parser cepat | Mammoth + unpdf di Vercel Node runtime | Tetap tersedia sebagai fallback |
| Parser kompleks | Belum dijalankan | FastAPI + Docling container |
| Validasi | Rules engine deterministik | Rules engine yang sama |
| AI | Opsional, usage-based | OpenAI atau provider/local model melalui adapter |

## Alur dokumen

1. API `/api/uploads/sign` mengautentikasi pengguna, membuat baris `rps_documents`, dan menghasilkan signed upload URL.
2. Browser mengunggah file langsung ke bucket privat `rps-source`.
3. API `/api/documents/parse` mengambil file dari Storage dan menjalankan parser ringan.
4. PDF scan, ZIP, format lama, atau file di atas batas ringan menghasilkan respons `enhanced_parser_required`.
5. Jika `PARSER_SERVICE_URL` tersedia, endpoint yang sama otomatis mengalihkan file tersebut ke Docling.
6. Rules engine menyimpan coverage dan caution pada `validation_summary`.
7. Jika AI diaktifkan, pengguna dapat meminta Structured Extraction; hasil tetap harus direview manusia.

## Batas free tier yang sengaja diterapkan

- Maksimum default parser ringan: 10 MB, 80 halaman, 45 detik proses parser.
- Upload memakai Supabase signed URL untuk menghindari body limit Vercel.
- AI default `disabled`; tidak ada pemanggilan berbayar tanpa konfigurasi eksplisit.
- Teks hasil parser disimpan sekali dalam JSONB dan digunakan ulang.
- OCR, gambar berat, dan ZIP tidak dipaksakan pada Vercel Function.

## Portabilitas

- `next.config.ts` menghasilkan standalone server.
- `Dockerfile` menjalankan hasil build tanpa Vercel runtime khusus.
- Seluruh perubahan database tersimpan sebagai migration SQL.
- Enhanced parser memiliki HTTP contract tetap dan token service-to-service.
- Endpoint Storage/Auth hanya menggunakan Supabase SDK yang juga kompatibel dengan self-hosted Supabase.
- `PARSER_SERVICE_URL`, model AI, bucket, dan batas parser seluruhnya dikendalikan environment variables.

## Urutan pengembangan berikutnya

1. Integrasikan halaman login Supabase ke prototipe.
2. Buat UI upload yang memanggil signed URL lalu `uploadToSignedUrl`.
3. Buat halaman review hasil rules-only.
4. Tambahkan structured AI sebagai tombol opsional, bukan proses otomatis.
5. Setelah server tersedia, aktifkan Docling dan OCR tanpa mengubah alur pengguna.

