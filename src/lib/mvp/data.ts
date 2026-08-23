import type {
  AcademicPeriod,
  AcademicWindow,
  AuditEntry,
  CourseOffering,
  CourseWorkspace,
  Institution,
  NavigationSection,
  ParserJob,
  PublicRpsDetail,
  RoleDashboard,
  RoleDefinition,
  RoleId,
  RpsRecord,
  SystemService,
  TeachingSubnavigationItem,
  UserRecord,
} from "./types";

export const roles: RoleDefinition[] = [
  {
    id: "admin",
    label: "Admin",
    shortLabel: "Admin",
    description: "Mengelola institusi, periode, akses, dan kesehatan platform.",
    scope: "Seluruh institusi",
    landingTitle: "Kendali platform",
  },
  {
    id: "kaprodi",
    label: "Ketua Program Studi",
    shortLabel: "Kaprodi",
    description: "Memastikan penugasan lengkap dan mengesahkan RPS di tingkat prodi.",
    scope: "S-1 Informatika",
    landingTitle: "Kendali mutu prodi",
  },
  {
    id: "gpm",
    label: "Gugus Penjaminan Mutu",
    shortLabel: "GPM",
    description: "Meninjau mutu, alignment OBE, dan tindak lanjut RPS.",
    scope: "RPS yang ditugaskan",
    landingTitle: "Meja review mutu",
  },
  {
    id: "dosen",
    label: "Dosen",
    shortLabel: "Dosen",
    description: "Merancang, menjalankan, dan mengevaluasi pengajaran berbasis RPS.",
    scope: "Mata kuliah yang diampu",
    landingTitle: "Pengajaran saya",
  },
  {
    id: "mahasiswa",
    label: "Mahasiswa",
    shortLabel: "Mahasiswa",
    description: "Melihat RPS resmi, jadwal pembelajaran, dan rencana asesmen.",
    scope: "Mata kuliah yang diambil",
    landingTitle: "RPS semester ini",
  },
];

export const navigation: NavigationSection[] = [
  {
    id: "platform",
    label: "Platform",
    items: [
      {
        id: "dashboard",
        label: "Dashboard",
        description: "Ringkasan dan tindakan terdekat",
        icon: "home",
        href: "/admin",
        roles: ["admin", "kaprodi", "gpm", "dosen", "mahasiswa"],
      },
      {
        id: "institusi-periode",
        label: "Institusi & Periode",
        description: "Kalender kerja dan penguncian",
        icon: "building",
        href: "#institusi-periode",
        roles: ["admin", "kaprodi"],
      },
      {
        id: "pengguna-akses",
        label: "Pengguna & Akses",
        description: "Akun, peran, dan ruang lingkup",
        icon: "users",
        href: "#pengguna-akses",
        roles: ["admin"],
      },
      {
        id: "monitoring-rps",
        label: "Monitoring RPS",
        description: "Progres, review, dan pengesahan",
        icon: "monitor",
        href: "#monitoring-rps",
        roles: ["admin", "kaprodi", "gpm"],
        badge: "7",
      },
      {
        id: "pengajaran-saya",
        label: "Pengajaran Saya",
        description: "Rancang, jalankan, dan evaluasi",
        icon: "book-open",
        href: "#pengajaran-saya",
        roles: ["dosen"],
      },
      {
        id: "rps-saya",
        label: "RPS Saya",
        description: "RPS resmi mata kuliah aktif",
        icon: "file-text",
        href: "#rps-saya",
        roles: ["mahasiswa"],
      },
    ],
  },
  {
    id: "sistem",
    label: "Sistem",
    items: [
      {
        id: "ai-parser",
        label: "AI & Parser",
        description: "Status ekstraksi dan validasi",
        icon: "sparkles",
        href: "#ai-parser",
        roles: ["admin"],
      },
      {
        id: "audit-log",
        label: "Audit Log",
        description: "Jejak aktivitas platform",
        icon: "history",
        href: "#audit-log",
        roles: ["admin"],
      },
      {
        id: "pengaturan",
        label: "Pengaturan",
        description: "Aturan dan preferensi platform",
        icon: "settings",
        href: "#pengaturan",
        roles: ["admin"],
      },
    ],
  },
];

// Level 2 navigation is deliberately kept at one nested level. The entries
// reuse the workspace state instead of introducing duplicate page routes.
export const teachingSubnavigation: TeachingSubnavigationItem[] = [
  {
    id: "courses",
    label: "Mata Kuliah Saya",
    description: "Pilih ruang kerja pengajaran",
  },
  {
    id: "rps",
    label: "RPS & Alignment",
    description: "Susun dan validasi RPS",
  },
  {
    id: "pelaksanaan",
    label: "Pelaksanaan",
    description: "Realisasi dan bukti",
  },
  {
    id: "evaluasi",
    label: "Evaluasi",
    description: "Capaian dan perbaikan",
  },
  {
    id: "riwayat",
    label: "Riwayat",
    description: "Versi, review, keputusan",
  },
];

export const roleDashboards: Record<RoleId, RoleDashboard> = {
  admin: {
    role: "admin",
    eyebrow: "Sabtu, 22 Agustus 2026",
    title: "Selamat malam, Admin",
    description: "Pantau kesiapan semester dan bereskan hambatan yang memerlukan kendali platform.",
    metrics: [
      { id: "institutions", label: "Institusi aktif", value: "1", detail: "3 program studi", tone: "blue", icon: "building" },
      { id: "users", label: "Pengguna aktif", value: "186", detail: "8 undangan menunggu", tone: "teal", icon: "users", trend: "+12 bulan ini" },
      { id: "rps", label: "RPS siap", value: "41/50", detail: "82% cakupan semester", tone: "green", icon: "check-circle" },
      { id: "late", label: "Lewat tenggat", value: "5", detail: "3 perlu eskalasi", tone: "red", icon: "alert-triangle" },
    ],
    actions: [
      { id: "adm-1", title: "5 RPS melewati tenggat", description: "Tiga prodi belum menutup penyusunan RPS.", context: "Monitoring RPS", dueLabel: "Perlu tindakan", priority: "critical", actionLabel: "Lihat RPS", href: "#monitoring-rps" },
      { id: "adm-2", title: "8 undangan belum diterima", description: "Kirim ulang atau batalkan akun yang tidak lagi diperlukan.", context: "Pengguna & Akses", dueLabel: "7 hari", priority: "medium", actionLabel: "Kelola akses", href: "#pengguna-akses" },
      { id: "adm-3", title: "Review GPM berakhir 3 hari lagi", description: "Penguncian lunak akan aktif otomatis setelah tenggat.", context: "Periode Gasal", dueLabel: "25 Agu", priority: "high", actionLabel: "Buka periode", href: "#institusi-periode" },
    ],
    workflowTitle: "Cakupan RPS semester aktif",
    workflowDescription: "Status lintas prodi; fokus pada RPS yang tertahan atau berisiko terlambat.",
    workflow: [
      { id: "adm-w1", code: "IF", title: "S-1 Informatika", owner: "Dr. Maya Putri", status: "gpm-review", statusLabel: "Review GPM", progress: 82, issueCount: 4, meta: "41 dari 50 RPS", actionLabel: "Pantau" },
      { id: "adm-w2", code: "SI", title: "S-1 Sistem Informasi", owner: "Dr. Reza Anwar", status: "revision", statusLabel: "Perlu revisi", progress: 76, issueCount: 7, meta: "32 dari 42 RPS", actionLabel: "Pantau" },
      { id: "adm-w3", code: "TI", title: "S-1 Teknologi Informasi", owner: "Dr. Nisa Rahma", status: "head-approval", statusLabel: "Pengesahan", progress: 91, issueCount: 2, meta: "30 dari 33 RPS", actionLabel: "Pantau" },
    ],
  },
  kaprodi: {
    role: "kaprodi",
    eyebrow: "S-1 Informatika · Gasal 2026/2027",
    title: "Satu RPS menunggu pengesahan",
    description: "Tinjau hasil review GPM dan pastikan seluruh mata kuliah memiliki dosen penanggung jawab.",
    metrics: [
      { id: "approval", label: "Perlu disahkan", value: "1", detail: "Jatuh tempo 25 Agustus", tone: "amber", icon: "shield" },
      { id: "coverage", label: "Cakupan RPS", value: "82%", detail: "41 dari 50 RPS", tone: "green", icon: "chart", trend: "+8% pekan ini" },
      { id: "unassigned", label: "Belum ada dosen", value: "2", detail: "Kelas perlu penugasan", tone: "red", icon: "users" },
      { id: "alignment", label: "Alignment rata-rata", value: "88", detail: "Target mutu ≥ 80", tone: "teal", icon: "check-circle" },
    ],
    actions: [
      { id: "kap-1", title: "Sahkan RPS Analitik Data", description: "Review GPM selesai tanpa temuan kritis.", context: "IF306 · Kelas A", dueLabel: "Hari ini", priority: "high", actionLabel: "Tinjau & sahkan", href: "#monitoring-rps", targetId: "rps-if306-a", intent: "approve" },
      { id: "kap-2", title: "Tunjuk dosen Basis Data B", description: "Kelas aktif belum memiliki dosen penanggung jawab.", context: "IF204 · Kelas B", dueLabel: "2 hari", priority: "critical", actionLabel: "Buka penugasan", href: "#institusi-periode", intent: "assign" },
      { id: "kap-3", title: "Periksa gap CPL-05", description: "Penguasaan akhir belum tampak pada empat mata kuliah.", context: "Peta kurikulum", dueLabel: "Pekan ini", priority: "medium", actionLabel: "Lihat analisis", href: "#monitoring-rps" },
    ],
    workflowTitle: "Status RPS prodi",
    workflowDescription: "Status dokumen di lingkup prodi; hanya yang berstatus pengesahan dapat diputuskan Kaprodi.",
    workflow: [
      { id: "kap-w1", code: "IF306", title: "Analitik Data", owner: "Nadia Karim, M.Kom.", status: "head-approval", statusLabel: "Siap disahkan", progress: 100, issueCount: 0, meta: "v3 · Review selesai", actionLabel: "Tinjau" },
      { id: "kap-w2", code: "IF402", title: "Etika Profesi", owner: "Arif Hidayat, M.Kom.", status: "revision", statusLabel: "Revisi dosen", progress: 94, issueCount: 2, meta: "v3 · Belum dapat disahkan", actionLabel: "Pantau" },
      { id: "kap-w3", code: "IF210", title: "Struktur Data", owner: "Bima Aditya, M.Kom.", status: "published", statusLabel: "Sudah terbit", progress: 100, issueCount: 0, meta: "v2 · Efektif 19 Agustus", actionLabel: "Lihat" },
    ],
  },
  gpm: {
    role: "gpm",
    eyebrow: "Meja mutu · Gasal 2026/2027",
    title: "Dua RPS perlu ditinjau",
    description: "Prioritaskan temuan yang memblokir pengajuan, lalu catat keputusan yang dapat ditelusuri.",
    metrics: [
      { id: "queue", label: "Antrian review", value: "2", detail: "1 temuan kritis", tone: "amber", icon: "file-text" },
      { id: "sla", label: "Rata-rata review", value: "1,8 hari", detail: "SLA target 3 hari", tone: "green", icon: "clock" },
      { id: "revision", label: "Menunggu revisi", value: "6", detail: "2 lewat 5 hari", tone: "red", icon: "history" },
      { id: "quality", label: "Lolos pertama", value: "72%", detail: "+6% dari semester lalu", tone: "teal", icon: "chart" },
    ],
    actions: [
      { id: "gpm-1", title: "Bobot asesmen belum 100%", description: "RPS Analisis Algoritma memiliki blocker validasi.", context: "IF220 · Bima Aditya", dueLabel: "Hari ini", priority: "critical", actionLabel: "Mulai review", href: "#monitoring-rps", targetId: "rps-if220-a", intent: "review" },
      { id: "gpm-2", title: "CPMK-03 kurang terukur", description: "Kata kerja belum selaras dengan bukti proyek C5.", context: "IF305 · Data Mining", dueLabel: "Besok", priority: "high", actionLabel: "Tinjau field", href: "#monitoring-rps", targetId: "rps-if305-a", intent: "review" },
      { id: "gpm-3", title: "Revisi belum dikirim ulang", description: "Dosen belum menindaklanjuti dua catatan sejak 17 Agustus.", context: "IF402 · Etika Profesi", dueLabel: "5 hari", priority: "medium", actionLabel: "Lihat tindak lanjut", href: "#monitoring-rps", targetId: "rps-if402-a", intent: "view" },
    ],
    workflowTitle: "Antrian review berdasarkan risiko",
    workflowDescription: "Urutan dibentuk dari blocker, tenggat, dan lama RPS berada di meja GPM.",
    workflow: [
      { id: "gpm-w1", code: "IF220", title: "Analisis Algoritma", owner: "Bima Aditya, M.Kom.", status: "gpm-review", statusLabel: "Ada blocker", progress: 88, issueCount: 3, meta: "Masuk 2 jam lalu", actionLabel: "Review" },
      { id: "gpm-w2", code: "IF305", title: "Data Mining", owner: "Nadia Karim, M.Kom.", status: "gpm-review", statusLabel: "Perlu tinjau", progress: 96, issueCount: 1, meta: "Masuk kemarin", actionLabel: "Review" },
      { id: "gpm-w3", code: "IF402", title: "Etika Profesi", owner: "Arif Hidayat, M.Kom.", status: "revision", statusLabel: "Menunggu revisi", progress: 94, issueCount: 2, meta: "5 hari di dosen", actionLabel: "Pantau" },
    ],
  },
  dosen: {
    role: "dosen",
    eyebrow: "Pengajaran saya · Gasal 2026/2027",
    title: "Lanjutkan dari tempat terakhir",
    description: "Selesaikan RPS, catat realisasi perkuliahan, dan tutup loop dengan evaluasi berbasis bukti.",
    metrics: [
      { id: "courses", label: "Mata kuliah", value: "3", detail: "2 RPS sudah terbit", tone: "blue", icon: "book-open" },
      { id: "draft", label: "Draft aktif", value: "1", detail: "Kesiapan 90%", tone: "amber", icon: "file-text" },
      { id: "meetings", label: "Pertemuan tercatat", value: "11/16", detail: "1 deviasi rencana", tone: "teal", icon: "calendar" },
      { id: "evaluation", label: "Evaluasi tertunda", value: "1", detail: "Dibuka setelah UAS", tone: "purple", icon: "chart" },
    ],
    actions: [
      { id: "dsn-1", title: "Lengkapi bobot asesmen", description: "Total masih 90%; pengajuan RPS diblokir sampai menjadi 100%.", context: "IF101 · Dasar Pemrograman", dueLabel: "Hari ini", priority: "critical", actionLabel: "Perbaiki RPS", href: "#pengajaran-saya", targetId: "course-if101-a", intent: "edit" },
      { id: "dsn-2", title: "Catat realisasi minggu 5", description: "Tambahkan bukti dan jelaskan deviasi dari rencana pembelajaran.", context: "IF306 · Analitik Data", dueLabel: "Besok", priority: "high", actionLabel: "Isi jurnal", href: "#pengajaran-saya", targetId: "course-if306-a", intent: "edit" },
      { id: "dsn-3", title: "Tindak lanjuti komentar GPM", description: "Dua catatan mutu menunggu jawaban dan versi baru.", context: "IF402 · Etika Profesi", dueLabel: "2 hari", priority: "medium", actionLabel: "Buka komentar", href: "#pengajaran-saya", targetId: "course-if402-a", intent: "edit" },
    ],
    workflowTitle: "Mata kuliah yang Anda ampu",
    workflowDescription: "Progres RPS, pelaksanaan, dan evaluasi ditampilkan terpisah agar tindakan berikutnya jelas.",
    workflow: [
      { id: "dsn-w1", code: "IF101", title: "Dasar Pemrograman · A", owner: "Anda", status: "draft", statusLabel: "Draft RPS", progress: 90, issueCount: 3, meta: "RPS 90% · Pelaksanaan 0%", actionLabel: "Lanjutkan" },
      { id: "dsn-w2", code: "IF306", title: "Analitik Data · A", owner: "Anda", status: "in-progress", statusLabel: "Sedang berjalan", progress: 31, issueCount: 1, meta: "5 dari 16 pertemuan", actionLabel: "Buka kelas" },
      { id: "dsn-w3", code: "IF402", title: "Etika Profesi · A", owner: "Anda", status: "revision", statusLabel: "Revisi diminta", progress: 94, issueCount: 2, meta: "RPS v3 · 2 komentar", actionLabel: "Revisi" },
    ],
  },
  mahasiswa: {
    role: "mahasiswa",
    eyebrow: "Semester Gasal 2026/2027",
    title: "RPS semester ini",
    description: "Lihat outcome, rencana pertemuan, asesmen, dan referensi dari versi RPS yang telah disahkan.",
    metrics: [
      { id: "active", label: "RPS aktif", value: "4", detail: "Semua dapat diakses", tone: "blue", icon: "file-text" },
      { id: "assessments", label: "Asesmen terdekat", value: "2", detail: "Dalam 14 hari", tone: "amber", icon: "calendar" },
      { id: "changes", label: "Pembaruan RPS", value: "1", detail: "Struktur Data v2", tone: "teal", icon: "history" },
      { id: "credits", label: "Total beban", value: "11 SKS", detail: "4 mata kuliah", tone: "purple", icon: "book-open" },
    ],
    actions: [
      { id: "mhs-1", title: "RPS Struktur Data diperbarui", description: "Versi 2 telah disahkan dan berlaku untuk semester aktif.", context: "IF210 · Versi 2", dueLabel: "Baru", priority: "medium", actionLabel: "Lihat RPS", href: "#rps-saya", targetId: "mhs-w4", intent: "view" },
      { id: "mhs-2", title: "UTS Dasar Pemrograman", description: "Studi kasus mengukur CPMK-01 sampai CPMK-03.", context: "IF101 · 30%", dueLabel: "12 hari lagi", priority: "high", actionLabel: "Lihat asesmen", href: "#rps-saya", targetId: "mhs-w1", intent: "view" },
    ],
    workflowTitle: "RPS resmi yang dapat diakses",
    workflowDescription: "Hanya versi yang telah disahkan dan berlaku pada semester aktif.",
    workflow: [
      { id: "mhs-w1", code: "IF101", title: "Dasar Pemrograman", owner: "Dr. Raka Pratama", status: "published", statusLabel: "Versi efektif", progress: 100, issueCount: 0, meta: "3 SKS · v1", actionLabel: "Buka RPS" },
      { id: "mhs-w2", code: "IF306", title: "Analitik Data", owner: "Nadia Karim, M.Kom.", status: "published", statusLabel: "Versi efektif", progress: 100, issueCount: 0, meta: "3 SKS · v2", actionLabel: "Buka RPS" },
      { id: "mhs-w3", code: "IF402", title: "Etika Profesi", owner: "Arif Hidayat, M.Kom.", status: "published", statusLabel: "Versi efektif", progress: 100, issueCount: 0, meta: "2 SKS · v2", actionLabel: "Buka RPS" },
      { id: "mhs-w4", code: "IF210", title: "Struktur Data", owner: "Bima Aditya, M.Kom.", status: "published", statusLabel: "Baru diterbitkan", progress: 100, issueCount: 0, meta: "3 SKS · v2", actionLabel: "Buka RPS" },
    ],
  },
};

export const institutions: Institution[] = [
  { id: "inst-01", name: "Universitas Nusantara", shortName: "UN", facultyCount: 1, programCount: 3, activeUserCount: 186, status: "active" },
];

export const academicPeriods: AcademicPeriod[] = [
  { id: "period-2026-gasal", institutionId: "inst-01", label: "Gasal 2026/2027", term: "Gasal", academicYear: "2026/2027", startsAt: "2026-08-17", endsAt: "2026-12-19", isActive: true },
  { id: "period-2026-genap", institutionId: "inst-01", label: "Genap 2026/2027", term: "Genap", academicYear: "2026/2027", startsAt: "2027-02-01", endsAt: "2027-06-12", isActive: false },
];

export const academicWindows: AcademicWindow[] = [
  { id: "win-1", periodId: "period-2026-gasal", stage: "assignment", title: "Penugasan pengajaran", description: "Kaprodi menetapkan dosen dan kelas aktif.", startsAt: "2026-07-20", deadlineAt: "2026-08-03", lockMode: "soft-lock", lockLabel: "Perpanjangan tercatat", audience: ["admin", "kaprodi"], exceptionCount: 2 },
  { id: "win-2", periodId: "period-2026-gasal", stage: "rps-authoring", title: "Penyusunan RPS", description: "Dosen membuat, memvalidasi, dan mengajukan RPS.", startsAt: "2026-08-01", deadlineAt: "2026-08-20", lockMode: "soft-lock", lockLabel: "Terkunci lunak", audience: ["dosen"], exceptionCount: 5 },
  { id: "win-3", periodId: "period-2026-gasal", stage: "gpm-review", title: "Review GPM", description: "GPM memeriksa alignment, bukti, dan kelengkapan.", startsAt: "2026-08-10", deadlineAt: "2026-08-25", lockMode: "open", lockLabel: "Dibuka", audience: ["gpm"], exceptionCount: 0 },
  { id: "win-4", periodId: "period-2026-gasal", stage: "head-approval", title: "Pengesahan Kaprodi", description: "Kaprodi memutuskan RPS yang telah lolos mutu.", startsAt: "2026-08-18", deadlineAt: "2026-08-29", lockMode: "open", lockLabel: "Dibuka", audience: ["kaprodi"], exceptionCount: 0 },
  { id: "win-5", periodId: "period-2026-gasal", stage: "teaching", title: "Pelaksanaan pengajaran", description: "Dosen mencatat realisasi, bukti, dan deviasi pertemuan.", startsAt: "2026-08-17", deadlineAt: "2026-12-05", lockMode: "open", lockLabel: "Sedang berjalan", audience: ["dosen"], exceptionCount: 0 },
  { id: "win-6", periodId: "period-2026-gasal", stage: "evaluation", title: "Evaluasi & tindak lanjut", description: "Ketercapaian outcome menjadi masukan RPS berikutnya.", startsAt: "2026-12-07", deadlineAt: "2026-12-23", lockMode: "scheduled", lockLabel: "Belum dibuka", audience: ["dosen", "gpm", "kaprodi"], exceptionCount: 0 },
];

export const courseOfferings: CourseOffering[] = [
  { id: "course-if101-a", code: "IF101", name: "Dasar Pemrograman", className: "A", credits: 3, program: "S-1 Informatika", periodId: "period-2026-gasal", lecturer: "Dr. Raka Pratama", studentCount: 36, status: "attention", statusLabel: "Perlu tindakan", rpsProgress: 90, deliveryProgress: 0, evaluationProgress: 0, nextAction: "Lengkapi bobot asesmen", dueLabel: "Hari ini" },
  { id: "course-if306-a", code: "IF306", name: "Analitik Data", className: "A", credits: 3, program: "S-1 Informatika", periodId: "period-2026-gasal", lecturer: "Nadia Karim, M.Kom.", studentCount: 32, status: "on-track", statusLabel: "Berjalan", rpsProgress: 100, deliveryProgress: 31, evaluationProgress: 0, nextAction: "Isi jurnal minggu 5", dueLabel: "Besok" },
  { id: "course-if402-a", code: "IF402", name: "Etika Profesi", className: "A", credits: 2, program: "S-1 Informatika", periodId: "period-2026-gasal", lecturer: "Arif Hidayat, M.Kom.", studentCount: 40, status: "review", statusLabel: "Revisi RPS", rpsProgress: 94, deliveryProgress: 0, evaluationProgress: 0, nextAction: "Jawab 2 komentar GPM", dueLabel: "2 hari" },
  { id: "course-if210-a", code: "IF210", name: "Struktur Data", className: "A", credits: 3, program: "S-1 Informatika", periodId: "period-2026-gasal", lecturer: "Bima Aditya, M.Kom.", studentCount: 34, status: "published", statusLabel: "RPS terbit", rpsProgress: 100, deliveryProgress: 25, evaluationProgress: 0, nextAction: "Lihat RPS", dueLabel: "Sesuai jadwal" },
  { id: "course-if220-a", code: "IF220", name: "Analisis Algoritma", className: "A", credits: 3, program: "S-1 Informatika", periodId: "period-2026-gasal", lecturer: "Bima Aditya, M.Kom.", studentCount: 31, status: "review", statusLabel: "Review GPM", rpsProgress: 88, deliveryProgress: 0, evaluationProgress: 0, nextAction: "Tindak lanjuti validation gate", dueLabel: "Hari ini" },
  { id: "course-if305-a", code: "IF305", name: "Data Mining", className: "A", credits: 3, program: "S-1 Informatika", periodId: "period-2026-gasal", lecturer: "Nadia Karim, M.Kom.", studentCount: 30, status: "review", statusLabel: "Review GPM", rpsProgress: 96, deliveryProgress: 0, evaluationProgress: 0, nextAction: "Tunggu hasil review", dueLabel: "Besok" },
];

export const rpsRecords: RpsRecord[] = [
  { id: "rps-if101-a", courseOfferingId: "course-if101-a", code: "IF101", courseName: "Dasar Pemrograman", owner: "Dr. Raka Pratama", period: "Gasal 2026/2027", status: "draft", statusLabel: "Draft", version: 2, readiness: 90, issues: 3, reviewer: "GPM Informatika", updatedAt: "22 Agu · 20.42", dueAt: "22 Agu 2026" },
  { id: "rps-if306-a", courseOfferingId: "course-if306-a", code: "IF306", courseName: "Analitik Data", owner: "Nadia Karim, M.Kom.", period: "Gasal 2026/2027", status: "head-approval", statusLabel: "Menunggu Kaprodi", version: 3, readiness: 100, issues: 0, reviewer: "Siti Lestari, M.Kom.", updatedAt: "21 Agu · 16.10", dueAt: "25 Agu 2026" },
  { id: "rps-if402-a", courseOfferingId: "course-if402-a", code: "IF402", courseName: "Etika Profesi", owner: "Arif Hidayat, M.Kom.", period: "Gasal 2026/2027", status: "revision", statusLabel: "Revisi diminta", version: 3, readiness: 94, issues: 2, reviewer: "Siti Lestari, M.Kom.", updatedAt: "20 Agu · 09.15", dueAt: "24 Agu 2026" },
  { id: "rps-if210-a", courseOfferingId: "course-if210-a", code: "IF210", courseName: "Struktur Data", owner: "Bima Aditya, M.Kom.", period: "Gasal 2026/2027", status: "published", statusLabel: "Dipublikasikan", version: 2, readiness: 100, issues: 0, reviewer: "GPM Informatika", updatedAt: "18 Agu · 13.05", dueAt: "20 Agu 2026", publishedAt: "19 Agu 2026" },
  { id: "rps-if220-a", courseOfferingId: "course-if220-a", code: "IF220", courseName: "Analisis Algoritma", owner: "Bima Aditya, M.Kom.", period: "Gasal 2026/2027", status: "gpm-review", statusLabel: "Review GPM", version: 1, readiness: 88, issues: 3, reviewer: "Siti Lestari, M.Kom.", updatedAt: "22 Agu · 18.10", dueAt: "23 Agu 2026" },
  { id: "rps-if305-a", courseOfferingId: "course-if305-a", code: "IF305", courseName: "Data Mining", owner: "Nadia Karim, M.Kom.", period: "Gasal 2026/2027", status: "gpm-review", statusLabel: "Review GPM", version: 2, readiness: 96, issues: 1, reviewer: "Siti Lestari, M.Kom.", updatedAt: "21 Agu · 14.20", dueAt: "24 Agu 2026" },
];

export const courseWorkspace: CourseWorkspace = {
  courseOfferingId: "course-if306-a",
  tabs: [
    { id: "rps", label: "RPS", description: "Rancang dan validasi", progress: 100, badge: "v3 · Menunggu sah" },
    { id: "pelaksanaan", label: "Pelaksanaan", description: "Realisasi dan bukti", progress: 31, badge: "5/16" },
    { id: "evaluasi", label: "Evaluasi", description: "Contoh semester lalu", progress: 75, badge: "Read-only" },
    { id: "riwayat", label: "Riwayat", description: "Versi dan keputusan", badge: "6" },
  ],
  rps: {
    readiness: 100,
    validationSummary: "12 pemeriksaan lolos · 2 caution · tanpa blocker",
    checklist: [
      { id: "rps-c1", label: "Informasi dasar", detail: "Identitas mata kuliah dan otorisasi lengkap.", status: "done" },
      { id: "rps-c2", label: "CPL → CPMK → asesmen", detail: "5 CPMK memiliki parent outcome dan bukti langsung.", status: "done" },
      { id: "rps-c3", label: "Rencana 16 pertemuan", detail: "Refleksi minggu 16 perlu dipertegas.", status: "warning", actionLabel: "Tinjau" },
      { id: "rps-c4", label: "Rubrik & target", detail: "Dua rubrik tertaut; satu indikator komunikasi perlu tinjau.", status: "warning", actionLabel: "Buka rubrik" },
      { id: "rps-c5", label: "Validation gate", detail: "Tidak ada masalah yang memblokir pengajuan.", status: "done" },
    ],
    outcomes: [
      { code: "CPMK-01", statement: "Menjelaskan konsep dan etika dasar analitik data.", status: "not-measured" },
      { code: "CPMK-02", statement: "Menerapkan teknik eksplorasi dan visualisasi data.", status: "not-measured" },
      { code: "CPMK-03", statement: "Mengevaluasi kualitas model dengan metrik yang tepat.", status: "not-measured" },
      { code: "CPMK-04", statement: "Mengomunikasikan insight untuk mendukung keputusan.", status: "not-measured" },
    ],
  },
  pelaksanaan: {
    completedMeetings: 5,
    totalMeetings: 16,
    deviationCount: 1,
    meetings: [
      { week: "1", plan: "Peran analitik data", realization: "Case method dan diskusi", evidence: "Exit ticket", status: "done" },
      { week: "2–3", plan: "Profiling & cleaning", realization: "Lab berpasangan", evidence: "Notebook 1", status: "done" },
      { week: "4", plan: "Eksplorasi data", realization: "Studio visualisasi", evidence: "Mini project", status: "done" },
      { week: "5", plan: "Eksplorasi multivariat", realization: "Diganti klinik data", evidence: "Perlu unggah", status: "changed" },
      { week: "6", plan: "Storytelling data", realization: "Belum dilaksanakan", evidence: "—", status: "upcoming" },
    ],
  },
  evaluasi: {
    classAttainment: 75,
    achievedOutcomes: 2,
    totalOutcomes: 4,
    criticalGaps: 1,
    outcomes: [
      { code: "CPMK-01", statement: "Konsep dan etika analitik data", attainment: 81, target: 75, status: "achieved" },
      { code: "CPMK-02", statement: "Eksplorasi dan visualisasi data", attainment: 76, target: 75, status: "achieved" },
      { code: "CPMK-03", statement: "Evaluasi kualitas model", attainment: 68, target: 75, status: "gap" },
      { code: "CPMK-04", statement: "Komunikasi insight", attainment: 74, target: 75, status: "caution" },
    ],
    improvements: [
      { id: "imp-1", finding: "CPMK-03 belum mencapai target", rootCause: "Scaffolding evaluasi model terlalu singkat.", action: "Tambah klinik data sebelum milestone proyek.", owner: "Nadia Karim", dueLabel: "RPS berikutnya", status: "planned" },
      { id: "imp-2", finding: "Komunikasi insight belum merata", rootCause: "Rubrik belum menilai jawaban berbasis bukti.", action: "Tambah satu indikator pada rubrik komunikasi.", owner: "Nadia Karim", dueLabel: "30 Des", status: "in-progress" },
    ],
  },
  riwayat: [
    { id: "hist-1", title: "Review mutu v3 diselesaikan", detail: "Versi 3 diteruskan ke Kaprodi tanpa temuan kritis.", actor: "Siti Lestari · GPM", timestamp: "21 Agu · 15.48", tone: "teal" },
    { id: "hist-2", title: "RPS v3 diajukan", detail: "Validation gate lolos tanpa blocker.", actor: "Nadia Karim · Dosen", timestamp: "20 Agu · 12.58", tone: "blue" },
    { id: "hist-3", title: "Usulan CPMK diterapkan pada v3", detail: "Saran AI disetujui secara eksplisit oleh dosen.", actor: "Nadia Karim · Dosen", timestamp: "20 Agu · 11.13", tone: "purple" },
    { id: "hist-4", title: "RPS v2 dipublikasikan", detail: "Versi efektif yang saat ini tersedia untuk mahasiswa.", actor: "Dr. Maya Putri · Kaprodi", timestamp: "31 Jul · 16.20", tone: "green" },
  ],
};

// Proyeksi publik sengaja terpisah dari workspace dosen. Hanya versi efektif dan
// field rencana yang boleh dikirim ke portal mahasiswa; realisasi, bukti internal,
// komentar reviewer, serta versi yang masih diproses tidak termasuk di sini.
export const publicRpsDetails: Record<string, PublicRpsDetail> = {
  IF101: {
    code: "IF101",
    version: 1,
    outcomes: [
      { code: "CPMK-01", statement: "Menjelaskan konsep dasar algoritma, data, dan program." },
      { code: "CPMK-02", statement: "Menyusun solusi terstruktur untuk masalah komputasi sederhana." },
      { code: "CPMK-03", statement: "Mengimplementasikan dan menguji program dasar secara bertanggung jawab." },
    ],
    assessments: [
      { title: "Latihan terstruktur", weight: "20%" },
      { title: "UTS · Studi kasus", weight: "30%" },
      { title: "Proyek akhir", weight: "40%" },
      { title: "Partisipasi", weight: "10%" },
    ],
    weeklyPlan: [
      { week: "1–2", topic: "Algoritma dan representasi data", method: "Demonstrasi & latihan", evidence: "Kuis diagnostik" },
      { week: "3–5", topic: "Kontrol alur dan fungsi", method: "Problem-based learning", evidence: "Latihan terstruktur" },
      { week: "6–8", topic: "Dekomposisi masalah", method: "Studi kasus", evidence: "UTS" },
      { week: "9–16", topic: "Struktur data dasar dan proyek", method: "Project-based learning", evidence: "Proyek akhir" },
    ],
  },
  IF306: {
    code: "IF306",
    version: 2,
    outcomes: [
      { code: "CPMK-01", statement: "Menjelaskan konsep dan etika dasar analitik data." },
      { code: "CPMK-02", statement: "Menerapkan teknik eksplorasi dan visualisasi data." },
      { code: "CPMK-03", statement: "Mengevaluasi kualitas model dengan metrik yang tepat." },
      { code: "CPMK-04", statement: "Mengomunikasikan insight untuk mendukung keputusan." },
    ],
    assessments: [
      { title: "Notebook eksplorasi", weight: "20%" },
      { title: "UTS · Studi kasus", weight: "25%" },
      { title: "Proyek kelompok", weight: "40%" },
      { title: "Refleksi individu", weight: "15%" },
    ],
    weeklyPlan: [
      { week: "1", topic: "Peran dan etika analitik data", method: "Case method", evidence: "Exit ticket" },
      { week: "2–3", topic: "Profiling dan cleaning", method: "Lab berpasangan", evidence: "Notebook 1" },
      { week: "4–6", topic: "Eksplorasi dan storytelling data", method: "Studio visualisasi", evidence: "Mini project" },
      { week: "7–10", topic: "Pemodelan dan evaluasi", method: "Problem-based learning", evidence: "UTS & notebook 2" },
      { week: "11–16", topic: "Proyek analitik end-to-end", method: "Project-based learning", evidence: "Proyek kelompok" },
    ],
  },
  IF402: {
    code: "IF402",
    version: 2,
    outcomes: [
      { code: "CPMK-01", statement: "Menjelaskan prinsip etika dan tanggung jawab profesi informatika." },
      { code: "CPMK-02", statement: "Menganalisis dilema etis dengan kerangka yang relevan." },
      { code: "CPMK-03", statement: "Merumuskan keputusan profesional yang dapat dipertanggungjawabkan." },
    ],
    assessments: [
      { title: "Jurnal refleksi", weight: "20%" },
      { title: "Analisis kasus", weight: "35%" },
      { title: "Debat terstruktur", weight: "20%" },
      { title: "Proyek kode etik", weight: "25%" },
    ],
    weeklyPlan: [
      { week: "1–3", topic: "Profesi, nilai, dan kode etik", method: "Diskusi terpandu", evidence: "Jurnal refleksi" },
      { week: "4–7", topic: "Privasi, bias, dan dampak sosial", method: "Case method", evidence: "Analisis kasus" },
      { week: "8–11", topic: "Keamanan dan akuntabilitas", method: "Debat terstruktur", evidence: "Debat" },
      { week: "12–16", topic: "Tata kelola teknologi", method: "Project-based learning", evidence: "Proyek kode etik" },
    ],
  },
  IF210: {
    code: "IF210",
    version: 2,
    outcomes: [
      { code: "CPMK-01", statement: "Membandingkan karakteristik struktur data linear dan non-linear." },
      { code: "CPMK-02", statement: "Mengimplementasikan struktur data sesuai kebutuhan masalah." },
      { code: "CPMK-03", statement: "Mengevaluasi efisiensi solusi berdasarkan kompleksitas operasi." },
    ],
    assessments: [
      { title: "Praktikum", weight: "30%" },
      { title: "UTS", weight: "25%" },
      { title: "Proyek implementasi", weight: "35%" },
      { title: "Kuis", weight: "10%" },
    ],
    weeklyPlan: [
      { week: "1–4", topic: "List, stack, dan queue", method: "Lab & pair programming", evidence: "Praktikum 1" },
      { week: "5–8", topic: "Tree dan traversal", method: "Problem-based learning", evidence: "UTS" },
      { week: "9–12", topic: "Hashing dan graph", method: "Lab terpandu", evidence: "Praktikum 2" },
      { week: "13–16", topic: "Pemilihan struktur data", method: "Project-based learning", evidence: "Proyek implementasi" },
    ],
  },
};

export const parserJobs: ParserJob[] = [
  { id: "job-1", rpsId: "rps-if101-a", fileName: "contoh-if101.docx", processingStatus: "needs-review", statusLabel: "Perlu tinjau", detail: "Contoh hasil: 3 field memerlukan konfirmasi", tone: "amber", actionLabel: "Tinjau" },
  { id: "job-2", rpsId: "rps-if306-a", fileName: "contoh-if306.docx", processingStatus: "ready", statusLabel: "Siap", detail: "Contoh hasil ekstraksi selesai", tone: "green", actionLabel: "Detail" },
  { id: "job-3", rpsId: "rps-if402-a", fileName: "contoh-if402.docx", processingStatus: "failed", statusLabel: "Gagal", detail: "Contoh kegagalan parser yang dapat dicoba ulang", tone: "red", actionLabel: "Simulasikan retry" },
];

export const users: UserRecord[] = [
  { id: "usr-1", name: "Admin Platform", email: "admin@example.test", initials: "AP", roles: ["admin"], unit: "Platform OBELIKS", status: "active", statusLabel: "Aktif", assignment: "Superadmin platform", lastActive: "Baru saja" },
  { id: "usr-2", name: "Maya Putri", email: "maya.putri@example.test", initials: "MP", roles: ["kaprodi", "dosen"], unit: "S-1 Informatika", status: "active", statusLabel: "Aktif", assignment: "Kaprodi · 1 kelas", lastActive: "8 menit lalu" },
  { id: "usr-3", name: "Siti Lestari", email: "siti.lestari@example.test", initials: "SL", roles: ["gpm", "dosen"], unit: "Fakultas Ilmu Komputer", status: "active", statusLabel: "Aktif", assignment: "GPM · 12 review", lastActive: "24 menit lalu" },
  { id: "usr-4", name: "Raka Pratama", email: "raka.pratama@example.test", initials: "RP", roles: ["dosen"], unit: "S-1 Informatika", status: "active", statusLabel: "Aktif", assignment: "3 kelas", lastActive: "1 jam lalu" },
  { id: "usr-5", name: "Nadia Karim", email: "nadia.karim@example.test", initials: "NK", roles: ["dosen"], unit: "S-1 Informatika", status: "active", statusLabel: "Aktif", assignment: "2 kelas", lastActive: "2 jam lalu" },
  { id: "usr-6", name: "Alya Ramadhani", email: "alya.rahma@example.test", initials: "AR", roles: ["mahasiswa"], unit: "S-1 Informatika", status: "active", statusLabel: "Aktif", assignment: "Semester 5 · 11 SKS", lastActive: "Hari ini" },
  { id: "usr-7", name: "Bima Aditya", email: "bima.aditya@example.test", initials: "BA", roles: ["dosen"], unit: "S-1 Informatika", status: "invited", statusLabel: "Diundang", assignment: "1 kelas", lastActive: "Belum masuk" },
];

export const systemServices: SystemService[] = [
  { id: "ai", name: "OBE Copilot", description: "Saran alignment dan validasi yang dapat dijelaskan.", status: "healthy", statusLabel: "Contoh normal", metric: "Contoh · 98,7% berhasil", lastChecked: "data fixture" },
  { id: "parser", name: "Document Parser", description: "Ekstraksi DOCX dan ZIP beserta provenance field.", status: "degraded", statusLabel: "Contoh degradasi", metric: "Contoh · 1 antrean gagal", lastChecked: "data fixture" },
  { id: "supabase", name: "Supabase", description: "Autentikasi, database, dan penyimpanan dokumen.", status: "healthy", statusLabel: "Contoh normal", metric: "Contoh · 142 ms", lastChecked: "data fixture" },
  { id: "vercel", name: "Vercel", description: "Aplikasi web dan fungsi serverless.", status: "healthy", statusLabel: "Contoh normal", metric: "Contoh · deploy siap", lastChecked: "data fixture" },
];

export const auditEntries: AuditEntry[] = [
  { id: "audit-1", actor: "Dr. Maya Putri", actorRole: "Kaprodi", action: "Mengesahkan RPS", target: "IF210 · Struktur Data v2", detail: "RPS dipublikasikan untuk mahasiswa.", timestamp: "19 Agu 2026 · 17.22", tone: "green" },
  { id: "audit-2", actor: "Siti Lestari", actorRole: "GPM", action: "Menyelesaikan review", target: "IF306 · Analitik Data v3", detail: "Tanpa temuan kritis; dua caution dicatat.", timestamp: "21 Agu 2026 · 15.48", tone: "teal" },
  { id: "audit-3", actor: "Rasyid Purnama", actorRole: "Admin", action: "Memperpanjang jendela", target: "Penyusunan RPS · S-1 Informatika", detail: "Perpanjangan 48 jam untuk lima RPS.", timestamp: "21 Agu 2026 · 10.05", tone: "amber" },
  { id: "audit-4", actor: "Nadia Karim", actorRole: "Dosen", action: "Menerapkan saran AI", target: "CPMK-03 · Analitik Data", detail: "Kata kerja diubah dari memahami menjadi mengevaluasi.", timestamp: "20 Agu 2026 · 13.11", tone: "purple" },
  { id: "audit-5", actor: "Sistem", actorRole: "Parser", action: "Mengekstrak dokumen", target: "rps-dasar-pemrograman-v1.docx", detail: "32 field terdeteksi; tiga membutuhkan konfirmasi.", timestamp: "20 Agu 2026 · 09.02", tone: "blue" },
];

export const getNavigationForRole = (role: RoleId) =>
  navigation
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => item.roles.includes(role)),
    }))
    .filter((section) => section.items.length > 0);

export const getRoleDefinition = (role: RoleId) => roles.find((item) => item.id === role)!;
