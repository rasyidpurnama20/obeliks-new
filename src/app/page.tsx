const stack = [
  ["Next.js + TypeScript", "Web dan API cepat dalam satu codebase dengan kontrak data yang ketat."],
  ["Supabase PostgreSQL", "Auth, Storage, Realtime, JSONB, RLS, dan pgvector dalam satu platform."],
  ["FastAPI + Docling", "Parser PDF, DOCX, Office, gambar, dan ZIP berjalan terpisah dari web."],
  ["Structured AI", "Responses API menghasilkan data RPS tervalidasi dan siap masuk database."],
];

export default function Home() {
  return (
    <main className="shell">
      <section className="hero">
        <div className="eyebrow">OBELIKS · Architecture Ready</div>
        <h1>RPS OBE yang cepat, terstruktur, dan siap memakai AI.</h1>
        <p className="lead">
          Fondasi teknis telah memisahkan antarmuka, parsing dokumen, ekstraksi AI, dan data agar setiap bagian dapat berkembang tanpa menghambat bagian lain.
        </p>
        <div className="actions">
          <a className="button primary" href="/prototype">Buka prototipe</a>
          <a className="button" href="/api/health">Cek konfigurasi API</a>
        </div>
      </section>
      <section className="grid" aria-label="Stack aplikasi">
        {stack.map(([title, text]) => (
          <article className="card" key={title}>
            <strong>{title}</strong>
            <p>{text}</p>
          </article>
        ))}
      </section>
    </main>
  );
}

