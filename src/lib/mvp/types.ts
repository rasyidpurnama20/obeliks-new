export type RoleId = "admin" | "kaprodi" | "gpm" | "dosen" | "mahasiswa";

export type Tone = "neutral" | "blue" | "teal" | "green" | "amber" | "red" | "purple";

export type IconName =
  | "home"
  | "building"
  | "users"
  | "monitor"
  | "book-open"
  | "file-text"
  | "sparkles"
  | "history"
  | "settings"
  | "calendar"
  | "shield"
  | "check-circle"
  | "alert-triangle"
  | "clock"
  | "chart"
  | "activity";

export interface RoleDefinition {
  id: RoleId;
  label: string;
  shortLabel: string;
  description: string;
  scope: string;
  landingTitle: string;
}

export type NavigationItemId =
  | "dashboard"
  | "institusi-periode"
  | "pengguna-akses"
  | "monitoring-rps"
  | "pengajaran-saya"
  | "rps-saya"
  | "ai-parser"
  | "audit-log"
  | "pengaturan";

export interface NavigationItem {
  id: NavigationItemId;
  label: string;
  description: string;
  icon: IconName;
  href: string;
  roles: RoleId[];
  badge?: string;
}

export interface NavigationSection {
  id: "platform" | "sistem";
  label: string;
  items: NavigationItem[];
}

export interface Metric {
  id: string;
  label: string;
  value: string;
  detail: string;
  tone: Tone;
  icon: IconName;
  trend?: string;
}

export type Priority = "critical" | "high" | "medium" | "low";

export interface ActionItem {
  id: string;
  title: string;
  description: string;
  context: string;
  dueLabel: string;
  priority: Priority;
  actionLabel: string;
  href: string;
  targetId?: string;
  intent?: "view" | "edit" | "review" | "approve" | "assign";
}

export type RpsWorkflowStatus =
  | "draft"
  | "submitted"
  | "gpm-review"
  | "revision"
  | "head-approval"
  | "published";

export type CourseLifecycleStatus =
  | "not-started"
  | "in-progress"
  | "completed";

export type WorkflowStatus = RpsWorkflowStatus | CourseLifecycleStatus;

export interface WorkflowRow {
  id: string;
  code: string;
  title: string;
  owner: string;
  status: WorkflowStatus;
  statusLabel: string;
  progress: number;
  issueCount: number;
  meta: string;
  actionLabel: string;
}

export interface RoleDashboard {
  role: RoleId;
  eyebrow: string;
  title: string;
  description: string;
  metrics: Metric[];
  actions: ActionItem[];
  workflowTitle: string;
  workflowDescription: string;
  workflow: WorkflowRow[];
}

export interface Institution {
  id: string;
  name: string;
  shortName: string;
  facultyCount: number;
  programCount: number;
  activeUserCount: number;
  status: "active" | "setup";
}

export interface AcademicPeriod {
  id: string;
  institutionId: string;
  label: string;
  term: "Gasal" | "Genap";
  academicYear: string;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
}

export type AcademicWindowStage =
  | "assignment"
  | "rps-authoring"
  | "gpm-review"
  | "head-approval"
  | "teaching"
  | "evaluation";

export type LockMode = "open" | "soft-lock" | "hard-lock" | "scheduled";

export interface AcademicWindow {
  id: string;
  periodId: string;
  stage: AcademicWindowStage;
  title: string;
  description: string;
  startsAt: string;
  deadlineAt: string;
  lockMode: LockMode;
  lockLabel: string;
  audience: RoleId[];
  exceptionCount: number;
}

export type CourseStatus = "attention" | "on-track" | "review" | "published" | "closed";

export interface CourseOffering {
  id: string;
  code: string;
  name: string;
  className: string;
  credits: number;
  program: string;
  periodId: string;
  lecturer: string;
  studentCount: number;
  status: CourseStatus;
  statusLabel: string;
  rpsProgress: number;
  deliveryProgress: number;
  evaluationProgress: number;
  nextAction: string;
  dueLabel: string;
}

export interface RpsRecord {
  id: string;
  courseOfferingId: string;
  code: string;
  courseName: string;
  owner: string;
  period: string;
  status: RpsWorkflowStatus;
  statusLabel: string;
  version: number;
  readiness: number;
  issues: number;
  reviewer: string;
  updatedAt: string;
  dueAt: string;
  publishedAt?: string;
}

export type WorkspaceTabId = "rps" | "pelaksanaan" | "evaluasi" | "riwayat";

export interface WorkspaceTab {
  id: WorkspaceTabId;
  label: string;
  description: string;
  progress?: number;
  badge?: string;
}

export type ChecklistStatus = "done" | "warning" | "blocked" | "pending";

export interface WorkspaceChecklistItem {
  id: string;
  label: string;
  detail: string;
  status: ChecklistStatus;
  actionLabel?: string;
}

export interface OutcomeItem {
  code: string;
  statement: string;
  attainment?: number;
  target?: number;
  status: "achieved" | "caution" | "gap" | "not-measured";
}

export interface TeachingMeeting {
  week: string;
  plan: string;
  realization: string;
  evidence: string;
  status: "done" | "changed" | "upcoming";
}

export interface ImprovementAction {
  id: string;
  finding: string;
  rootCause: string;
  action: string;
  owner: string;
  dueLabel: string;
  status: "planned" | "in-progress" | "done";
}

export interface WorkspaceHistoryEntry {
  id: string;
  title: string;
  detail: string;
  actor: string;
  timestamp: string;
  tone: Tone;
}

export interface CourseWorkspace {
  courseOfferingId: string;
  tabs: WorkspaceTab[];
  rps: {
    readiness: number;
    validationSummary: string;
    checklist: WorkspaceChecklistItem[];
    outcomes: OutcomeItem[];
  };
  pelaksanaan: {
    completedMeetings: number;
    totalMeetings: number;
    deviationCount: number;
    meetings: TeachingMeeting[];
  };
  evaluasi: {
    classAttainment: number;
    achievedOutcomes: number;
    totalOutcomes: number;
    criticalGaps: number;
    outcomes: OutcomeItem[];
    improvements: ImprovementAction[];
  };
  riwayat: WorkspaceHistoryEntry[];
}

export interface PublicRpsDetail {
  code: string;
  version: number;
  outcomes: Array<{ code: string; statement: string }>;
  assessments: Array<{ title: string; weight: string }>;
  weeklyPlan: Array<{ week: string; topic: string; method: string; evidence: string }>;
}

export type ProcessingStatus = "queued" | "parsing" | "needs-review" | "ready" | "failed";

export interface ParserJob {
  id: string;
  rpsId: string;
  fileName: string;
  processingStatus: ProcessingStatus;
  statusLabel: string;
  detail: string;
  tone: Tone;
  actionLabel: "Detail" | "Tinjau" | "Simulasikan retry";
}

export type UserStatus = "active" | "invited" | "suspended";

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  initials: string;
  roles: RoleId[];
  unit: string;
  status: UserStatus;
  statusLabel: string;
  assignment: string;
  lastActive: string;
}

export type ServiceStatus = "healthy" | "degraded" | "offline";

export interface SystemService {
  id: "ai" | "parser" | "supabase" | "vercel";
  name: string;
  description: string;
  status: ServiceStatus;
  statusLabel: string;
  metric: string;
  lastChecked: string;
}

export interface AuditEntry {
  id: string;
  actor: string;
  actorRole: string;
  action: string;
  target: string;
  detail: string;
  timestamp: string;
  tone: Tone;
}
