# Arsitektur OBELIKS

## Pilihan stack

| Lapisan | Pilihan | Alasan |
|---|---|---|
| Web dan API | Next.js 16 App Router, React 19, TypeScript | Satu codebase, rendering cepat, Route Handlers, mudah di-deploy |
| UI | CSS tokens dahulu; Tailwind/shadcn dapat ditambah saat komponen dimigrasikan | Menjaga scaffold ringan dan tidak mengunci desain prototipe |
| Data | Supabase PostgreSQL | Relasional untuk CPL–CPMK sekaligus fleksibel melalui JSONB |
| Keamanan | Supabase Auth + PostgreSQL RLS | Hak akses melekat pada data, bukan hanya middleware web |
| File | Supabase Storage bucket privat | File sumber tidak masuk database atau Git |
| Vektor | pgvector di PostgreSQL | Pencarian semantik tanpa vector database terpisah |
| Parser | FastAPI + Docling | Parsing berat dipisah dari request web dan dapat autoscale |
| AI | OpenAI Responses API + Structured Outputs/Zod | Hasil mengikuti schema yang sama dengan TypeScript |
| Job state | `document_jobs` + Realtime | UI dapat menampilkan queued → parsing → extracting → review |

## Alur dokumen

1. Browser mengunggah DOCX/PDF/ZIP ke bucket privat `rps-source`.
2. API membuat `document_jobs` dengan idempotency key/checksum.
3. Worker parser mengambil file dan menghasilkan representasi Markdown serta metadata struktur.
4. AI hanya menerima teks terpilih, bukan file mentah, lalu mengembalikan Structured Output.
5. Hasil disimpan pada `rps_documents.structured_data`; sumber mentah tetap di `raw_extraction` untuk audit.
6. Field dengan confidence rendah atau isu aturan OBE masuk `validation_summary` dan diperiksa manusia.

## Prinsip performa dan biaya

- Parse satu kali, simpan hasilnya, dan gunakan checksum untuk deduplikasi.
- Jangan mengirim gambar/file penuh ke model jika Docling sudah menghasilkan teks yang cukup.
- Mulai evaluasi akurasi dengan model terkuat; gunakan `gpt-5.6-terra` sebagai default operasional setelah lolos dataset evaluasi.
- Batasi output AI dengan schema dan simpan versi prompt/model untuk reproducibility.
- Gunakan index B-tree untuk relasi/status, GIN untuk JSONB, dan HNSW hanya untuk chunk yang benar-benar dicari semantik.
- Jalankan parser sebagai worker terpisah agar autoscaling web tidak membawa beban ML/OCR.

## Tahap pengembangan

### Tahap 1 — fondasi

- Auth organisasi, course, dokumen, job, upload privat.
- Parser DOCX/PDF/ZIP.
- Structured extraction dan halaman review.

### Tahap 2 — OBE engine

- CPL, CPMK, Sub-CPMK dan matriks keterkaitan.
- Rules engine deterministik untuk bobot, total jam, dan kelengkapan.
- AI hanya untuk interpretasi, rekomendasi, dan field ambigu.

### Tahap 3 — skala

- Queue terkelola/polling worker dengan `FOR UPDATE SKIP LOCKED`.
- Observability, eval dataset, prompt versioning, caching, dan rate limit.
- RAG terhadap kebijakan kampus/SN-Dikti dengan RLS-aware pgvector.

