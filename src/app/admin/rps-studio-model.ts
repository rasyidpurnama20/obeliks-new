export type Contribution = 0 | 1 | 2 | 3;

export type RpsOutcome = {
  id: string;
  code: string;
  description: string;
  english: string;
};

export type RpsCpmk = {
  id: string;
  code: string;
  text: string;
  english: string;
  weight: number;
  maps: Record<string, Contribution>;
};

export type RpsSubCpmk = {
  id: string;
  code: string;
  cpmkId: string;
  text: string;
  level: string;
};

export type RpsScheduleRow = {
  week: number;
  cpmkId: string;
  topic: string;
  subtopic: string;
  subCpmkId: string;
  method: string;
  media: string;
  assessment: string;
};

export type RpsEvaluation = {
  id: string;
  name: string;
  weight: number;
  cpmkIds: string[];
  notes: string;
};

export type RpsRubric = {
  id: string;
  criterion: string;
  cpmkId: string;
  weight: number;
  level4: string;
  level3: string;
  level2: string;
  level1: string;
};

export type RpsEvidence = {
  id: string;
  code: string;
  assessment: string;
  cpmkId: string;
  type: string;
  location: string;
  semester: string;
  status: "Pending" | "Verified";
};

export type RpsAttainment = {
  id: string;
  cpmkId: string;
  targetScore: number;
  targetStudents: number;
  mean: number | null;
  achievedStudents: number | null;
  notes: string;
};

export type RpsImprovement = {
  id: string;
  outcome: string;
  finding: string;
  evidence: string;
  rootCause: string;
  action: string;
  pic: string;
  status: "Planned" | "Done" | "Verified";
};

export type RpsStudioState = {
  schemaVersion: "rps-obe-studio-1";
  meta: {
    institution: string;
    faculty: string;
    program: string;
    courseName: string;
    courseNameEn: string;
    code: string;
    kbk: string;
    credits: number;
    semester: number;
    review: string;
    descriptionId: string;
    descriptionEn: string;
    prerequisites: string;
  };
  cplCatalog: RpsOutcome[];
  cpl: RpsOutcome[];
  cpmk: RpsCpmk[];
  subCpmk: RpsSubCpmk[];
  schedule: RpsScheduleRow[];
  evaluations: RpsEvaluation[];
  rubrics: RpsRubric[];
  evidence: RpsEvidence[];
  attainment: RpsAttainment[];
  improvements: RpsImprovement[];
  references: { main: string[]; additional: string[] };
  validation: {
    author: string;
    authorId: string;
    coordinator: string;
    coordinatorId: string;
    head: string;
    headId: string;
  };
  curriculumContext: {
    program: string;
    curriculum: string;
    currentRole: "I" | "R" | "M";
  };
  audit: {
    validated: boolean;
    reverified: boolean;
    verifiedAt: string;
    hash: string;
    exampleGenerated: boolean;
  };
};

export type StudioIssue = { severity: "error" | "warning" | "pass"; title: string; detail: string };

const bloomRules = [
  { level: "C6", verbs: ["menciptakan", "merancang", "mengembangkan", "membangun", "menghasilkan"] },
  { level: "C5", verbs: ["mengevaluasi", "menilai", "membandingkan", "memvalidasi"] },
  { level: "C4", verbs: ["menganalisis", "menguraikan", "mengidentifikasi", "membedakan"] },
  { level: "C3", verbs: ["menerapkan", "menggunakan", "mengimplementasikan", "menghitung"] },
  { level: "C2", verbs: ["menjelaskan", "mengklasifikasikan", "merangkum", "menginterpretasikan"] },
  { level: "C1", verbs: ["mengingat", "menyebutkan", "mengenali"] },
] as const;

export function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function obj(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function text(value: unknown) {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function num(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function arr(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function outcomeRows(value: unknown, prefix: string): RpsOutcome[] {
  return arr(value).map((item, index) => {
    const row = obj(item);
    return {
      id: text(row.id) || `${prefix}-${index + 1}`,
      code: text(row.code || row.kode || row.internal_id) || `${prefix.toUpperCase()}-${String(index + 1).padStart(2, "0")}`,
      description: text(row.description || row.deskripsi || row.statement || row.text),
      english: text(row.english || row.en || row.description_en || row.official_description),
    };
  });
}

function cpmkRows(value: unknown): RpsCpmk[] {
  return arr(value).map((item, index) => {
    const row = obj(item);
    const maps = obj(row.maps || row.mapping || row.cpl_mapping || row.plo_mapping);
    return {
      id: text(row.id) || `cpmk-${index + 1}`,
      code: text(row.code || row.kode) || `CPMK-${String(index + 1).padStart(2, "0")}`,
      text: text(row.text || row.description || row.deskripsi || row.statement),
      english: text(row.english || row.en || row.description_en),
      weight: num(row.weight || row.bobot, 0),
      maps: Object.fromEntries(Object.entries(maps).map(([key, value]) => [key, Math.max(0, Math.min(3, num(value, 0))) as Contribution])),
    };
  });
}

function defaultSchedule() {
  return Array.from({ length: 16 }, (_, index): RpsScheduleRow => ({
    week: index + 1,
    cpmkId: "",
    topic: index === 7 ? "Ujian Tengah Semester" : index === 15 ? "Ujian Akhir Semester" : "",
    subtopic: "",
    subCpmkId: "",
    method: index === 7 || index === 15 ? "Assessment" : "",
    media: "",
    assessment: index === 7 ? "UTS" : index === 15 ? "UAS" : "",
  }));
}

export function createStudioState(input: {
  code: string;
  courseName: string;
  owner: string;
  period: string;
  structuredData?: Record<string, unknown>;
}): RpsStudioState {
  const data = input.structuredData ?? {};
  const meta = obj(data.meta || data.identity || data.identitas);
  const catalog = outcomeRows(data.cpl_catalog || data.program_learning_outcomes || data.plo_catalog, "cpl");
  const assigned = outcomeRows(data.cpl || data.plo || data.assigned_cpl, "cpl");
  const cpmk = cpmkRows(data.cpmk || data.clo || data.course_learning_outcomes);
  const rawSub = arr(data.sub_cpmk || data.subCpmk || data.sub_clo);
  const rawSchedule = arr(data.schedule || data.learning_schedule);
  const rawEvaluations = arr(data.evaluations || data.assessments || data.assessment_plan);
  const rawRubrics = arr(data.rubrics || data.rubric);
  const rawEvidence = arr(data.evidence || data.assessment_evidence);
  const rawAttainment = arr(data.attainment || data.cpmk_attainment);
  const rawImprovements = arr(data.improvements || data.gaps || data.corrective_actions);
  const refs = obj(data.references);
  const validation = obj(data.validation);
  const curriculum = obj(data.curriculum_context || data.curriculum);
  const audit = obj(data.audit);

  return {
    schemaVersion: "rps-obe-studio-1",
    meta: {
      institution: text(meta.institution) || "Universitas Diponegoro",
      faculty: text(meta.faculty) || "Fakultas Sains dan Matematika",
      program: text(meta.program) || "S-1 Informatika",
      courseName: text(meta.courseName || meta.course_name) || input.courseName,
      courseNameEn: text(meta.courseNameEn || meta.course_name_en),
      code: text(meta.code || meta.course_code) || input.code,
      kbk: text(meta.kbk || meta.knowledge_group),
      credits: num(meta.credits || meta.sks, 0),
      semester: num(meta.semester, 0),
      review: text(meta.review) || input.period,
      descriptionId: text(meta.descriptionId || meta.description_id || meta.description),
      descriptionEn: text(meta.descriptionEn || meta.description_en),
      prerequisites: text(meta.prerequisites),
    },
    cplCatalog: catalog.length ? catalog : assigned,
    cpl: assigned,
    cpmk,
    subCpmk: rawSub.map((item, index) => {
      const row = obj(item);
      const cpmkCode = text(row.cpmk || row.cpmk_code || row.clo);
      return {
        id: text(row.id) || `sub-${index + 1}`,
        code: text(row.code) || `Sub-CPMK-${index + 1}`,
        cpmkId: text(row.cpmkId) || cpmk.find((value) => value.code === cpmkCode)?.id || "",
        text: text(row.text || row.description || row.statement),
        level: text(row.level || row.bloom) || "C3",
      };
    }),
    schedule: rawSchedule.length ? rawSchedule.map((item, index) => {
      const row = obj(item);
      return {
        week: num(row.week, index + 1),
        cpmkId: text(row.cpmkId),
        topic: text(row.topic),
        subtopic: text(row.subtopic),
        subCpmkId: text(row.subCpmkId),
        method: text(row.method),
        media: text(row.media),
        assessment: text(row.assessment),
      };
    }) : defaultSchedule(),
    evaluations: rawEvaluations.map((item, index) => {
      const row = obj(item);
      return { id: text(row.id) || `eval-${index + 1}`, name: text(row.name || row.title), weight: num(row.weight), cpmkIds: arr(row.cpmkIds || row.cpmk_ids).map(text), notes: text(row.notes) };
    }),
    rubrics: rawRubrics.map((item, index) => {
      const row = obj(item);
      return { id: text(row.id) || `rubric-${index + 1}`, criterion: text(row.criterion), cpmkId: text(row.cpmkId), weight: num(row.weight), level4: text(row.level4 || row.d4), level3: text(row.level3 || row.d3), level2: text(row.level2 || row.d2), level1: text(row.level1 || row.d1) };
    }),
    evidence: rawEvidence.map((item, index) => {
      const row = obj(item);
      return { id: text(row.id) || `evidence-${index + 1}`, code: text(row.code) || `EV-${String(index + 1).padStart(2, "0")}`, assessment: text(row.assessment), cpmkId: text(row.cpmkId), type: text(row.type), location: text(row.location), semester: text(row.semester), status: row.status === "Verified" ? "Verified" : "Pending" };
    }),
    attainment: rawAttainment.map((item, index) => {
      const row = obj(item);
      return { id: text(row.id) || `att-${index + 1}`, cpmkId: text(row.cpmkId), targetScore: num(row.targetScore, 70), targetStudents: num(row.targetStudents, 75), mean: row.mean == null ? null : num(row.mean), achievedStudents: row.achievedStudents == null ? null : num(row.achievedStudents), notes: text(row.notes) };
    }),
    improvements: rawImprovements.map((item, index) => {
      const row = obj(item);
      return { id: text(row.id) || `imp-${index + 1}`, outcome: text(row.outcome), finding: text(row.finding), evidence: text(row.evidence), rootCause: text(row.rootCause || row.root_cause), action: text(row.action), pic: text(row.pic), status: row.status === "Done" || row.status === "Verified" ? row.status : "Planned" };
    }),
    references: { main: arr(refs.main).map(text), additional: arr(refs.additional).map(text) },
    validation: {
      author: text(validation.author) || input.owner,
      authorId: text(validation.authorId || validation.author_id),
      coordinator: text(validation.coordinator),
      coordinatorId: text(validation.coordinatorId || validation.coordinator_id),
      head: text(validation.head),
      headId: text(validation.headId || validation.head_id),
    },
    curriculumContext: {
      program: text(curriculum.program) || "S-1 Informatika",
      curriculum: text(curriculum.name || curriculum.curriculum) || "Kurikulum 2024 OBE",
      currentRole: curriculum.currentRole === "R" || curriculum.currentRole === "M" ? curriculum.currentRole : "I",
    },
    audit: {
      validated: audit.validated === true,
      reverified: audit.reverified === true,
      verifiedAt: text(audit.verifiedAt),
      hash: text(audit.hash),
      exampleGenerated: audit.exampleGenerated === true,
    },
  };
}

export function detectBloom(value: string) {
  const normalized = value.toLocaleLowerCase("id-ID");
  for (const rule of bloomRules) {
    const verb = rule.verbs.find((candidate) => normalized.includes(candidate));
    if (verb) return { level: rule.level, verb };
  }
  return { level: "?", verb: "—" };
}

export function totalEvaluationWeight(state: RpsStudioState) {
  return state.evaluations.reduce((sum, item) => sum + (Number(item.weight) || 0), 0);
}

export function validationIssues(state: RpsStudioState): StudioIssue[] {
  const issues: StudioIssue[] = [];
  const push = (severity: StudioIssue["severity"], title: string, detail: string) => issues.push({ severity, title, detail });
  const requiredMeta = [state.meta.institution, state.meta.faculty, state.meta.program, state.meta.courseName, state.meta.code];
  requiredMeta.some((value) => !value.trim()) ? push("error", "Identitas belum lengkap", "Institusi, fakultas, program, mata kuliah, dan kode wajib tersedia.") : push("pass", "Identitas lengkap", "Identitas utama RPS tersedia.");
  state.cpl.length ? push("pass", "CPL dipilih", `${state.cpl.length} CPL dibebankan ke mata kuliah.`) : push("error", "CPL belum dipilih", "Pilih CPL dari katalog program atau tambahkan CPL secara manual.");
  state.cpmk.length ? push("pass", "CPMK tersedia", `${state.cpmk.length} CPMK tersimpan.`) : push("error", "CPMK kosong", "Minimal satu CPMK diperlukan.");
  const unmapped = state.cpmk.filter((item) => !state.cpl.some((cpl) => (item.maps[cpl.id] ?? 0) > 0));
  unmapped.length ? push("error", "CPMK belum terpetakan", `${unmapped.length} CPMK belum memiliki kontribusi ke CPL.`) : state.cpmk.length && push("pass", "CPMK → CPL terpetakan", "Seluruh CPMK memiliki mapping.");
  const weakBloom = state.cpmk.filter((item) => detectBloom(item.text).level === "?");
  weakBloom.length ? push("warning", "Bloom perlu diperiksa", `${weakBloom.length} CPMK belum menggunakan kata kerja yang dikenali checker.`) : state.cpmk.length && push("pass", "Bloom terukur", "Kata kerja CPMK dapat dikenali.");
  const cpmkWeight = state.cpmk.reduce((sum, item) => sum + (Number(item.weight) || 0), 0);
  Math.abs(cpmkWeight - 100) > 0.01 ? push("warning", "Bobot CPMK bukan 100%", `Total saat ini ${cpmkWeight}%.`) : push("pass", "Bobot CPMK = 100%", "Bobot outcome konsisten.");
  const evaluationWeight = totalEvaluationWeight(state);
  Math.abs(evaluationWeight - 100) > 0.01 ? push("error", "Bobot evaluasi bukan 100%", `Total saat ini ${evaluationWeight}%.`) : push("pass", "Bobot evaluasi = 100%", "Rencana evaluasi konsisten.");
  const scheduleMissing = state.schedule.filter((row) => ![8, 16].includes(row.week) && (!row.topic.trim() || !row.method.trim()));
  scheduleMissing.length ? push("warning", "Jadwal belum lengkap", `${scheduleMissing.length} minggu belum memiliki topik dan metode lengkap.`) : push("pass", "Jadwal lengkap", "Rencana 16 minggu tersedia.");
  if (state.audit.exampleGenerated) push("warning", "Berisi hasil Generator Contoh", "Konten contoh wajib direview dan disesuaikan sebelum finalisasi.");
  if (state.audit.reverified) push("pass", "Dokumen terverifikasi", `${state.audit.verifiedAt} · ${state.audit.hash}`);
  else push("error", "Belum verifikasi ulang", "Export DOCX dikunci sampai validasi dan verifikasi manual selesai.");
  return issues;
}

function evenWeights(count: number) {
  if (!count) return [];
  const base = Math.floor(100 / count);
  return Array.from({ length: count }, (_, index) => index === count - 1 ? 100 - base * (count - 1) : base);
}

export function generateExample(current: RpsStudioState): RpsStudioState {
  const next = structuredClone(current);
  const catalog = next.cplCatalog.length ? next.cplCatalog : next.cpl;
  next.cpl = catalog.slice(0, Math.min(6, catalog.length)).map((item) => ({ ...item }));
  while (next.cpl.length < 4) {
    const index = next.cpl.length + 1;
    next.cpl.push({ id: `example-cpl-${index}`, code: `CPL-${String(index).padStart(2, "0")}`, description: `Contoh CPL ${index} — ganti dengan CPL resmi program studi.`, english: "" });
  }
  const programming = /dasar pemrograman/i.test(next.meta.courseName);
  const descriptions = programming ? [
    "Mahasiswa mampu menjelaskan konsep algoritma dan representasi program.",
    "Mahasiswa mampu menerapkan variabel, ekspresi, percabangan, dan perulangan untuk menyelesaikan masalah.",
    "Mahasiswa mampu menganalisis masalah dan menguraikannya menjadi langkah algoritmik.",
    "Mahasiswa mampu merancang program modular menggunakan fungsi dan struktur data sederhana.",
    "Mahasiswa mampu mengevaluasi ketepatan dan kualitas solusi program melalui pengujian dan debugging.",
    "Mahasiswa mampu mengembangkan mini project pemrograman secara terstruktur dan mengomunikasikan hasilnya.",
  ] : [
    `Mahasiswa mampu menjelaskan konsep utama pada mata kuliah ${next.meta.courseName}.`,
    `Mahasiswa mampu menerapkan metode pada ${next.meta.courseName} untuk menyelesaikan masalah terstruktur.`,
    `Mahasiswa mampu menganalisis permasalahan dan memilih pendekatan yang sesuai pada ${next.meta.courseName}.`,
    `Mahasiswa mampu merancang solusi berbasis konsep ${next.meta.courseName}.`,
    `Mahasiswa mampu mengevaluasi kualitas solusi menggunakan kriteria yang terukur.`,
    `Mahasiswa mampu mengembangkan dan mengomunikasikan solusi atau proyek akhir secara sistematis.`,
  ];
  const weights = evenWeights(descriptions.length);
  next.cpmk = descriptions.map((description, index) => ({
    id: `example-cpmk-${index + 1}`,
    code: `CPMK-${String(index + 1).padStart(2, "0")}`,
    text: description,
    english: "",
    weight: weights[index],
    maps: Object.fromEntries(next.cpl.map((cpl, cplIndex) => [cpl.id, (cplIndex === index % next.cpl.length ? 3 : cplIndex === (index + 1) % next.cpl.length ? 1 : 0) as Contribution])),
  }));
  next.subCpmk = Array.from({ length: 8 }, (_, index) => {
    const cpmk = next.cpmk[Math.min(next.cpmk.length - 1, Math.floor(index * next.cpmk.length / 8))];
    return { id: `example-sub-${index + 1}`, code: `Sub-CPMK-${index + 1}`, cpmkId: cpmk.id, text: `${cpmk.text.replace(/Mahasiswa mampu\s*/i, "Mahasiswa mampu ")} pada konteks pembelajaran minggu ${index + 1}.`, level: detectBloom(cpmk.text).level === "?" ? "C3" : detectBloom(cpmk.text).level };
  });
  const topics = programming ? ["Pengantar algoritma & problem solving", "Variabel, tipe data, ekspresi", "Percabangan", "Perulangan", "Fungsi & modularisasi", "Array/list", "String & struktur data sederhana", "Ujian Tengah Semester", "File I/O & exception", "Decomposition & debugging", "Pencarian & pengurutan dasar", "Perancangan solusi modular", "Mini project: desain", "Mini project: implementasi", "Mini project: evaluasi", "Ujian Akhir Semester"] : Array.from({ length: 16 }, (_, index) => index === 7 ? "Ujian Tengah Semester" : index === 15 ? "Ujian Akhir Semester" : `Topik contoh ${index + 1} — sesuaikan dengan bahan kajian mata kuliah`);
  next.schedule = topics.map((topic, index) => ({ week: index + 1, cpmkId: [7, 15].includes(index) ? "" : next.cpmk[Math.min(next.cpmk.length - 1, Math.floor(index * next.cpmk.length / 15))].id, topic, subtopic: [7, 15].includes(index) ? "Instrumen ujian" : "Bahan kajian & referensi", subCpmkId: [7, 15].includes(index) ? "" : next.subCpmk[Math.min(next.subCpmk.length - 1, Math.floor(index * next.subCpmk.length / 15))].id, method: [7, 15].includes(index) ? "Assessment" : index > 11 ? "Project Based Learning" : "Kuliah, diskusi, dan latihan", media: [7, 15].includes(index) ? "Soal & rubrik" : "LMS, slide, buku, perangkat praktik", assessment: index === 7 ? "UTS" : index === 15 ? "UAS" : index > 11 ? "Project" : index % 3 === 0 ? "Quiz" : "Exercise" }));
  next.evaluations = [
    { id: "eval-quiz", name: "Quiz", weight: 10, cpmkIds: [next.cpmk[0].id], notes: "Contoh — review manual" },
    { id: "eval-assignment", name: "Exercise/Assignment", weight: 20, cpmkIds: [next.cpmk[1].id], notes: "Contoh — review manual" },
    { id: "eval-uts", name: "UTS", weight: 20, cpmkIds: next.cpmk.slice(0, 3).map((item) => item.id), notes: "Contoh — review manual" },
    { id: "eval-project", name: "Project", weight: 30, cpmkIds: next.cpmk.slice(2, 6).map((item) => item.id), notes: "Contoh — review manual" },
    { id: "eval-uas", name: "UAS", weight: 20, cpmkIds: next.cpmk.slice(3).map((item) => item.id), notes: "Contoh — review manual" },
  ];
  next.rubrics = ["Ketepatan konsep", "Kebenaran solusi", "Kualitas implementasi", "Analisis & argumentasi", "Komunikasi hasil"].map((criterion, index) => ({ id: `rubric-${index + 1}`, criterion, cpmkId: next.cpmk[Math.min(index, next.cpmk.length - 1)].id, weight: 20, level4: "Sangat tepat, lengkap, mandiri, dan konsisten.", level3: "Tepat dengan kekurangan minor.", level2: "Sebagian benar, masih ada kekeliruan penting.", level1: "Belum menunjukkan kompetensi minimum." }));
  next.evidence = next.evaluations.map((evaluation, index) => ({ id: `evidence-${index + 1}`, code: `EV-${String(index + 1).padStart(2, "0")}`, assessment: evaluation.name, cpmkId: evaluation.cpmkIds[0] ?? "", type: "Soal/Jawaban/Rubrik/Proyek", location: "", semester: next.meta.review, status: "Pending" }));
  next.attainment = next.cpmk.map((item, index) => ({ id: `att-${index + 1}`, cpmkId: item.id, targetScore: 70, targetStudents: 75, mean: null, achievedStudents: null, notes: "" }));
  next.improvements = next.cpmk.map((item, index) => ({ id: `imp-${index + 1}`, outcome: item.code, finding: "Belum ada evidence attainment; isi setelah pelaksanaan.", evidence: "", rootCause: "", action: "", pic: "", status: "Planned" }));
  next.references = programming ? { main: ["Cormen, T. H., et al. Introduction to Algorithms. MIT Press, 2022.", "Downey, A. Think Python. O’Reilly Media, 2015."], additional: ["Python Software Foundation. Python Documentation, current edition."] } : { main: ["Tambahkan referensi utama yang digunakan pada mata kuliah."], additional: [] };
  next.audit = { validated: false, reverified: false, verifiedAt: "", hash: "", exampleGenerated: true };
  return next;
}

export function markDirty(state: RpsStudioState): RpsStudioState {
  return { ...state, audit: { ...state.audit, validated: false, reverified: false, verifiedAt: "", hash: "" } };
}

export function simpleHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0").toUpperCase();
}
