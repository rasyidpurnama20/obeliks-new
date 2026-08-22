export type RuleIssue = {
  severity: "info" | "warning" | "error";
  field: string;
  message: string;
  recommendation: string;
  source: "rule";
};

const sections = [
  { field: "cpl", pattern: /capaian pembelajaran lulusan|\bCPL\b/i, label: "CPL" },
  { field: "cpmk", pattern: /capaian pembelajaran mata kuliah|\bCPMK\b/i, label: "CPMK" },
  { field: "subCpmk", pattern: /sub[ -]?CPMK/i, label: "Sub-CPMK" },
  { field: "weeklyPlan", pattern: /minggu ke|rencana pembelajaran|bahan kajian/i, label: "rencana mingguan" },
  { field: "assessment", pattern: /penilaian|asesmen|bobot/i, label: "rencana penilaian" },
  { field: "references", pattern: /referensi|daftar pustaka/i, label: "referensi" },
] as const;

export function validateRpsText(text: string): {
  coverage: Record<string, boolean>;
  issues: RuleIssue[];
} {
  const coverage: Record<string, boolean> = {};
  const issues: RuleIssue[] = [];

  for (const section of sections) {
    const found = section.pattern.test(text);
    coverage[section.field] = found;
    if (!found) {
      issues.push({
        severity: "warning",
        field: section.field,
        message: `Bagian ${section.label} belum terdeteksi oleh pemeriksaan aturan.`,
        recommendation: "Periksa dokumen sumber dan lengkapi atau tandai bagian tersebut secara manual.",
        source: "rule",
      });
    }
  }

  if (text.trim().length < 500) {
    issues.push({
      severity: "error",
      field: "document",
      message: "Teks hasil parser terlalu pendek untuk divalidasi dengan aman.",
      recommendation: "Gunakan DOCX asli atau jalankan enhanced parser/OCR untuk PDF hasil pemindaian.",
      source: "rule",
    });
  }

  return { coverage, issues };
}

