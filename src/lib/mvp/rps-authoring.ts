export type RpsValidationStatus = "passed" | "caution" | "blocked";

export interface RpsPolicySnapshot {
  id: string;
  label: string;
  effectiveFrom: string;
  expectedMeetingCount: number;
  assessmentWeightTotal: number;
  attainmentTarget: number;
}

export interface RpsAuthoringDraft {
  identity: {
    courseCode: string;
    courseName: string;
    credits: number;
    semester: number;
    program: string;
    lecturer: string;
    description: string;
  };
  cpl: Array<{ code: string; statement: string }>;
  cpmk: Array<{ code: string; statement: string; bloom: string; cplCodes: string[] }>;
  subCpmk: Array<{ code: string; statement: string; cpmkCode: string }>;
  assessments: Array<{
    code: string;
    title: string;
    weight: number;
    cpmkCodes: string[];
    subCpmkCodes: string[];
    evidence: string;
  }>;
  weeklyPlan: Array<{
    week: number;
    subCpmkCodes: string[];
    topic: string;
    method: string;
    assessmentCode?: string;
  }>;
  references: string[];
  approvals: Array<{
    role: "penyusun" | "gpm" | "kaprodi";
    actorId: string;
    actor: string;
    status: "signed" | "pending";
  }>;
}

export interface RpsValidationResult {
  id: string;
  label: string;
  detail: string;
  status: RpsValidationStatus;
}

export const rpsPolicyExample: RpsPolicySnapshot = {
  id: "policy-if-gasal-2026",
  label: "Kebijakan Prodi Informatika · Gasal 2026/2027",
  effectiveFrom: "2026-08-01",
  expectedMeetingCount: 16,
  assessmentWeightTotal: 100,
  attainmentTarget: 75,
};

export const rpsAuthoringExample: RpsAuthoringDraft = {
  identity: {
    courseCode: "IF306",
    courseName: "Analitik Data",
    credits: 3,
    semester: 5,
    program: "S-1 Informatika",
    lecturer: "Nadia Karim, M.Kom.",
    description: "Mata kuliah membangun kemampuan mengeksplorasi, mengevaluasi, dan mengomunikasikan insight data secara etis.",
  },
  cpl: [
    { code: "CPL-02", statement: "Menerapkan pengetahuan komputasi untuk menyelesaikan masalah berbasis data." },
    { code: "CPL-03", statement: "Mengomunikasikan hasil analisis secara efektif dan dapat dipertanggungjawabkan." },
    { code: "CPL-05", statement: "Menunjukkan praktik profesional, etis, dan sadar dampak." },
  ],
  cpmk: [
    { code: "CPMK-01", statement: "Menjelaskan konsep dan etika dasar analitik data.", bloom: "C2", cplCodes: ["CPL-05"] },
    { code: "CPMK-02", statement: "Menerapkan teknik eksplorasi dan visualisasi data.", bloom: "C3", cplCodes: ["CPL-02"] },
    { code: "CPMK-03", statement: "Mengevaluasi kualitas model dengan metrik yang tepat.", bloom: "C5", cplCodes: ["CPL-02"] },
    { code: "CPMK-04", statement: "Mengomunikasikan insight untuk mendukung keputusan.", bloom: "C4", cplCodes: ["CPL-03", "CPL-05"] },
  ],
  subCpmk: [
    { code: "Sub-CPMK-01", statement: "Menguraikan peran, risiko, dan prinsip etika analitik data.", cpmkCode: "CPMK-01" },
    { code: "Sub-CPMK-02", statement: "Memeriksa kualitas dan kesiapan sebuah himpunan data.", cpmkCode: "CPMK-02" },
    { code: "Sub-CPMK-03", statement: "Menyajikan pola data dengan visualisasi yang sesuai.", cpmkCode: "CPMK-02" },
    { code: "Sub-CPMK-04", statement: "Membandingkan model menggunakan metrik dan batasannya.", cpmkCode: "CPMK-03" },
    { code: "Sub-CPMK-05", statement: "Menyusun rekomendasi berbasis bukti untuk pemangku kepentingan.", cpmkCode: "CPMK-04" },
  ],
  assessments: [
    { code: "ASM-01", title: "Notebook eksplorasi", weight: 20, cpmkCodes: ["CPMK-02"], subCpmkCodes: ["Sub-CPMK-02", "Sub-CPMK-03"], evidence: "Notebook dan catatan kualitas data" },
    { code: "ASM-02", title: "Studi kasus tengah semester", weight: 25, cpmkCodes: ["CPMK-01", "CPMK-02"], subCpmkCodes: ["Sub-CPMK-01", "Sub-CPMK-03"], evidence: "Analisis kasus individual" },
    { code: "ASM-03", title: "Proyek analitik kelompok", weight: 40, cpmkCodes: ["CPMK-03", "CPMK-04"], subCpmkCodes: ["Sub-CPMK-04", "Sub-CPMK-05"], evidence: "Repositori, laporan, dan presentasi" },
    { code: "ASM-04", title: "Refleksi individu", weight: 15, cpmkCodes: ["CPMK-01", "CPMK-04"], subCpmkCodes: ["Sub-CPMK-01", "Sub-CPMK-05"], evidence: "Refleksi keputusan dan kontribusi" },
  ],
  weeklyPlan: [
    { week: 1, subCpmkCodes: ["Sub-CPMK-01"], topic: "Peran dan etika analitik data", method: "Case method", assessmentCode: "ASM-04" },
    { week: 2, subCpmkCodes: ["Sub-CPMK-02"], topic: "Profiling data", method: "Laboratorium berpasangan", assessmentCode: "ASM-01" },
    { week: 3, subCpmkCodes: ["Sub-CPMK-02"], topic: "Cleaning dan dokumentasi data", method: "Laboratorium berpasangan", assessmentCode: "ASM-01" },
    { week: 4, subCpmkCodes: ["Sub-CPMK-03"], topic: "Eksplorasi univariat", method: "Studio visualisasi", assessmentCode: "ASM-01" },
    { week: 5, subCpmkCodes: ["Sub-CPMK-03"], topic: "Eksplorasi multivariat", method: "Klinik data", assessmentCode: "ASM-01" },
    { week: 6, subCpmkCodes: ["Sub-CPMK-03"], topic: "Storytelling data", method: "Peer critique", assessmentCode: "ASM-02" },
    { week: 7, subCpmkCodes: ["Sub-CPMK-01", "Sub-CPMK-03"], topic: "Integrasi studi kasus", method: "Case method", assessmentCode: "ASM-02" },
    { week: 8, subCpmkCodes: ["Sub-CPMK-01", "Sub-CPMK-03"], topic: "Studi kasus tengah semester", method: "Asesmen terstruktur", assessmentCode: "ASM-02" },
    { week: 9, subCpmkCodes: ["Sub-CPMK-04"], topic: "Validasi dan pembagian data", method: "Problem-based learning", assessmentCode: "ASM-03" },
    { week: 10, subCpmkCodes: ["Sub-CPMK-04"], topic: "Metrik evaluasi model", method: "Problem-based learning", assessmentCode: "ASM-03" },
    { week: 11, subCpmkCodes: ["Sub-CPMK-04"], topic: "Analisis kesalahan dan keterbatasan", method: "Klinik model", assessmentCode: "ASM-03" },
    { week: 12, subCpmkCodes: ["Sub-CPMK-05"], topic: "Perumusan insight", method: "Project-based learning", assessmentCode: "ASM-03" },
    { week: 13, subCpmkCodes: ["Sub-CPMK-05"], topic: "Desain rekomendasi", method: "Project-based learning", assessmentCode: "ASM-03" },
    { week: 14, subCpmkCodes: ["Sub-CPMK-05"], topic: "Validasi dengan pemangku kepentingan", method: "Simulasi review", assessmentCode: "ASM-03" },
    { week: 15, subCpmkCodes: ["Sub-CPMK-05"], topic: "Presentasi proyek", method: "Presentasi dan tanya jawab", assessmentCode: "ASM-03" },
    { week: 16, subCpmkCodes: ["Sub-CPMK-01", "Sub-CPMK-05"], topic: "Refleksi dan tindak lanjut", method: "Refleksi terstruktur", assessmentCode: "ASM-04" },
  ],
  references: [
    "Provost, F. & Fawcett, T. Data Science for Business.",
    "Kelleher, J. D. & Tierney, B. Data Science.",
  ],
  approvals: [
    { role: "penyusun", actorId: "user-dosen-if306", actor: "Nadia Karim, M.Kom.", status: "signed" },
    { role: "gpm", actorId: "user-gpm-if", actor: "Siti Lestari, M.Kom.", status: "signed" },
    { role: "kaprodi", actorId: "user-kaprodi-if", actor: "Dr. Maya Putri", status: "pending" },
  ],
};

function hasUniqueCodes(items: Array<{ code: string }>) {
  const codes = items.map((item) => item.code.trim());
  return codes.every(Boolean) && new Set(codes).size === items.length;
}

export function validateRpsDraft(
  draft: RpsAuthoringDraft,
  policy: RpsPolicySnapshot,
): RpsValidationResult[] {
  const cplCodes = new Set(draft.cpl.map((item) => item.code));
  const cpmkCodes = new Set(draft.cpmk.map((item) => item.code));
  const subCpmkCodes = new Set(draft.subCpmk.map((item) => item.code));
  const assessmentCodes = new Set(draft.assessments.map((item) => item.code));
  const mappedCpmk = new Set(draft.assessments.flatMap((item) => item.cpmkCodes));
  const assessmentTotal = draft.assessments.reduce((sum, item) => sum + item.weight, 0);
  const uniqueWeeks = new Set(draft.weeklyPlan.map((item) => item.week));
  const identityComplete = Object.values(draft.identity).every((value) => value !== "" && value !== 0);
  const codesAreUnique = [draft.cpl, draft.cpmk, draft.subCpmk, draft.assessments].every(hasUniqueCodes);
  const relationshipsValid =
    draft.cpmk.every((item) => item.cplCodes.length > 0 && item.cplCodes.every((code) => cplCodes.has(code))) &&
    draft.subCpmk.every((item) => cpmkCodes.has(item.cpmkCode)) &&
    draft.assessments.every(
      (item) => item.cpmkCodes.length > 0 && item.cpmkCodes.every((code) => cpmkCodes.has(code)) && item.subCpmkCodes.length > 0 && item.subCpmkCodes.every((code) => subCpmkCodes.has(code)) && item.evidence.trim().length > 0,
    ) &&
    draft.weeklyPlan.every(
      (item) => item.subCpmkCodes.length > 0 && item.subCpmkCodes.every((code) => subCpmkCodes.has(code)) && (!item.assessmentCode || assessmentCodes.has(item.assessmentCode)),
    );
  const everyCpmkMeasured = [...cpmkCodes].every((code) => mappedCpmk.has(code));
  const meetingPlanValid =
    draft.weeklyPlan.length === policy.expectedMeetingCount &&
    uniqueWeeks.size === policy.expectedMeetingCount &&
    [...uniqueWeeks].sort((left, right) => left - right).every((week, index) => week === index + 1);
  const approvalActors = draft.approvals.map((item) => item.actorId);
  const approvalOrderValid = draft.approvals.map((item) => item.role).join(",") === "penyusun,gpm,kaprodi";
  const noSelfApproval = new Set(approvalActors).size === approvalActors.length;

  return [
    {
      id: "identity",
      label: "Identitas & deskripsi",
      detail: identityComplete ? "Field wajib terisi dari data kanonik mata kuliah." : "Ada field identitas wajib yang kosong.",
      status: identityComplete ? "passed" : "blocked",
    },
    {
      id: "unique-codes",
      label: "Kode unik",
      detail: codesAreUnique ? "Kode CPL, CPMK, Sub-CPMK, dan asesmen tidak duplikat." : "Terdapat kode yang dipakai lebih dari sekali.",
      status: codesAreUnique ? "passed" : "blocked",
    },
    {
      id: "relationships",
      label: "Relasi OBE",
      detail: relationshipsValid ? "Seluruh foreign key CPL → CPMK → Sub-CPMK → asesmen valid." : "Ada relasi OBE yang kosong atau menunjuk kode tidak dikenal.",
      status: relationshipsValid ? "passed" : "blocked",
    },
    {
      id: "coverage",
      label: "Cakupan asesmen",
      detail: everyCpmkMeasured ? "Setiap CPMK memiliki sekurangnya satu bukti asesmen." : "Ada CPMK yang belum memiliki bukti asesmen.",
      status: everyCpmkMeasured ? "passed" : "blocked",
    },
    {
      id: "assessment-weight",
      label: "Bobot asesmen",
      detail: `Total ${assessmentTotal}% · target kebijakan ${policy.assessmentWeightTotal}%.`,
      status: Math.abs(assessmentTotal - policy.assessmentWeightTotal) <= 0.01 ? "passed" : "blocked",
    },
    {
      id: "weekly-plan",
      label: "Rencana pembelajaran",
      detail: `${draft.weeklyPlan.length}/${policy.expectedMeetingCount} minggu unik sesuai snapshot kebijakan.`,
      status: meetingPlanValid ? "passed" : "blocked",
    },
    {
      id: "references",
      label: "Referensi",
      detail: draft.references.length ? `${draft.references.length} referensi tercatat.` : "Referensi belum dicantumkan.",
      status: draft.references.length ? "passed" : "blocked",
    },
    {
      id: "approval-boundary",
      label: "Batas keputusan manusia",
      detail: approvalOrderValid && noSelfApproval ? "Urutan Penyusun → GPM → Kaprodi valid dan tidak ada self-approval." : "Urutan atau pemisahan aktor persetujuan tidak valid.",
      status: approvalOrderValid && noSelfApproval ? "passed" : "blocked",
    },
  ];
}
