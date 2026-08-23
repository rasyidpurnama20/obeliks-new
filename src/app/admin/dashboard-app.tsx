"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  academicPeriods,
  academicWindows,
  auditEntries,
  courseOfferings,
  courseWorkspace,
  getNavigationForRole,
  getRoleDefinition,
  institutions,
  parserJobs,
  publicRpsDetails,
  roleDashboards,
  roles,
  rpsRecords,
  systemServices,
  teachingSubnavigation,
} from "@/lib/mvp/data";
import type { ManagedUser } from "@/lib/admin/user-types";
import type {
  AcademicWindow,
  IconName,
  LockMode,
  NavigationItemId,
  Priority,
  RoleId,
  TeachingSubnavigationId,
  Tone,
  WorkflowStatus,
  WorkspaceTabId,
} from "@/lib/mvp/types";
import styles from "./dashboard.module.css";
import { RpsAuthoringPanel } from "./rps-authoring-panel";
import { UserManagementPanel } from "./user-management-panel";

type DashboardAppProps = {
  email: string;
  displayName?: string | null;
  initialRole: RoleId;
  availableRoles: RoleId[];
  initialManagedUsers: ManagedUser[];
  signOutAction: () => Promise<void>;
};

const workflowTones: Record<WorkflowStatus, Tone> = {
  "not-started": "neutral",
  draft: "amber",
  submitted: "blue",
  "gpm-review": "purple",
  revision: "red",
  "head-approval": "amber",
  published: "green",
  "in-progress": "teal",
  completed: "green",
};

const lockOptions: { value: LockMode; label: string }[] = [
  { value: "open", label: "Dibuka" },
  { value: "soft-lock", label: "Kunci lunak" },
  { value: "hard-lock", label: "Kunci penuh" },
  { value: "scheduled", label: "Terjadwal" },
];

const iconPaths: Record<IconName, string> = {
  home: "M3 10.5 12 3l9 7.5M5 9.5V21h14V9.5M9 21v-7h6v7",
  building: "M4 21V5l8-3 8 3v16M8 8h.01M12 8h.01M16 8h.01M8 12h.01M12 12h.01M16 12h.01M9 21v-5h6v5",
  users: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
  monitor: "M3 4h18v12H3zM8 20h8M12 16v4",
  "book-open": "M2 4h6a4 4 0 0 1 4 4v13a4 4 0 0 0-4-4H2zM22 4h-6a4 4 0 0 0-4 4v13a4 4 0 0 1 4-4h6z",
  "file-text": "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h8M8 9h2",
  sparkles: "m12 3 1.1 3.4L16.5 7.5l-3.4 1.1L12 12l-1.1-3.4L7.5 7.5l3.4-1.1zM19 13l.8 2.2L22 16l-2.2.8L19 19l-.8-2.2L16 16l2.2-.8zM5 14l.8 1.7L7.5 16.5l-1.7.7L5 19l-.8-1.8-1.7-.7 1.7-.8z",
  history: "M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 2",
  settings: "M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21h-4v-.1A1.7 1.7 0 0 0 8.6 19a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3v-4h.1A1.7 1.7 0 0 0 5 8.6a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3h4v.1A1.7 1.7 0 0 0 15.4 5a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.13.4.36.75.68 1 .3.24.69.38 1.08.4h.1v4h-.1a1.7 1.7 0 0 0-1.76.6Z",
  calendar: "M6 2v4M18 2v4M3 9h18M5 4h14a2 2 0 0 1 2 2v15H3V6a2 2 0 0 1 2-2Z",
  shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10ZM9 12l2 2 4-4",
  "check-circle": "M22 11.1V12a10 10 0 1 1-5.9-9.1M22 4 12 14l-3-3",
  "alert-triangle": "M10.3 3.7 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.7a2 2 0 0 0-3.4 0ZM12 9v4M12 17h.01",
  clock: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM12 6v6l4 2",
  chart: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  activity: "M3 12h4l2-7 4 14 2-7h6",
};

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg aria-hidden="true" className={styles.icon} height={size} viewBox="0 0 24 24" width={size}>
      <path d={iconPaths[name]} />
    </svg>
  );
}

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function toneClass(tone: Tone) {
  return styles[`tone_${tone}`];
}

function priorityClass(priority: Priority) {
  return styles[`priority_${priority}`];
}

function StatusBadge({ label, tone = "neutral" }: { label: string; tone?: Tone }) {
  return <span className={cx(styles.badge, toneClass(tone))}>{label}</span>;
}

function Progress({ value, tone = "blue", label }: { value: number; tone?: Tone; label?: string }) {
  return (
    <div className={styles.progressGroup}>
      {label ? <div className={styles.progressLabel}><span>{label}</span><strong>{value}%</strong></div> : null}
      <div aria-label={`${label ?? "Progres"} ${value}%`} aria-valuemax={100} aria-valuemin={0} aria-valuenow={value} className={styles.progress} role="progressbar">
        <span className={toneClass(tone)} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
      </div>
    </div>
  );
}

function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className={styles.pageHeading}>
      <div>
        <p className={styles.eyebrow}>{eyebrow}</p>
        <h1 tabIndex={-1}>{title}</h1>
        <p className={styles.pageDescription}>{description}</p>
      </div>
      {action ? <div className={styles.headingAction}>{action}</div> : null}
    </div>
  );
}

function SectionHeading({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className={styles.sectionHeading}>
      <div><h2>{title}</h2>{description ? <p>{description}</p> : null}</div>
      {action}
    </div>
  );
}

export function DashboardApp({
  email,
  displayName,
  initialRole,
  availableRoles,
  initialManagedUsers,
  signOutAction,
}: DashboardAppProps) {
  const [role, setRole] = useState<RoleId>(initialRole);
  const [screen, setScreen] = useState<NavigationItemId>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [workspaceCourse, setWorkspaceCourse] = useState<string | null>(null);
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTabId>("rps");
  const [teachingView, setTeachingView] = useState<TeachingSubnavigationId>("courses");
  const [studentRps, setStudentRps] = useState<string | null>(null);
  const [monitoringRecord, setMonitoringRecord] = useState<string | null>(null);
  const [reviewDecisions, setReviewDecisions] = useState<Record<string, string>>({});
  const [uploadedFile, setUploadedFile] = useState("Contoh_RPS_Analitik_Data.docx");
  const [toast, setToast] = useState("");
  const [isMobile, setIsMobile] = useState(false);
  const [lockModes, setLockModes] = useState<Record<string, LockMode>>(
    Object.fromEntries(academicWindows.map((window) => [window.id, window.lockMode])),
  );
  const [managedUsers, setManagedUsers] = useState(initialManagedUsers);
  const [aiMode, setAiMode] = useState<"rules" | "openai">("rules");
  const [settingsState, setSettingsState] = useState({ reminders: true, autoLock: true, digest: false, provenance: true });

  const navSections = useMemo(() => getNavigationForRole(role), [role]);
  const roleDefinition = getRoleDefinition(role);
  const dashboard = roleDashboards[role];
  const activeNav = navSections.flatMap((section) => section.items).find((item) => item.id === screen);
  const activeTeachingItem = teachingSubnavigation.find((item) => item.id === teachingView);
  const sidebarRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 920px)");
    const syncMedia = () => setIsMobile(media.matches);
    syncMedia();
    media.addEventListener("change", syncMedia);
    return () => media.removeEventListener("change", syncMedia);
  }, []);

  useEffect(() => {
    const syncFromLocation = () => {
      const [requestedSegment, courseSegment, teachingSegment] = window.location.hash.replace(/^#/, "").split("/");
      const requested = requestedSegment as NavigationItemId;
      if (!requested) {
        setScreen("dashboard");
        setWorkspaceCourse(null);
        setTeachingView("courses");
        return;
      }
      const allowed = navSections.some((section) => section.items.some((item) => item.id === requested));
      const target = allowed ? requested : "dashboard";
      setScreen(target);
      setStudentRps(null);
      setMonitoringRecord(null);
      if (target === "pengajaran-saya") {
        const courseExists = courseOfferings.some((course) => course.id === courseSegment);
        const requestedTeachingView = teachingSubnavigation.some((item) => item.id === teachingSegment)
          ? teachingSegment as TeachingSubnavigationId
          : courseExists
            ? "rps"
            : "courses";
        setWorkspaceCourse(courseExists ? courseSegment : null);
        setTeachingView(requestedTeachingView);
        if (requestedTeachingView !== "courses") setWorkspaceTab(requestedTeachingView);
      } else {
        setWorkspaceCourse(null);
        setTeachingView("courses");
      }
    };
    syncFromLocation();
    window.addEventListener("popstate", syncFromLocation);
    window.addEventListener("hashchange", syncFromLocation);
    return () => {
      window.removeEventListener("popstate", syncFromLocation);
      window.removeEventListener("hashchange", syncFromLocation);
    };
  }, [navSections]);

  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  }

  async function handleRpsFileSelected(file: File) {
    const maximumBytes = 10 * 1024 * 1024;
    if (!file.name.toLocaleLowerCase("id-ID").endsWith(".docx")) {
      notify("Berkas ditolak: pilih dokumen .docx.");
      return;
    }
    if (file.size === 0 || file.size > maximumBytes) {
      notify("Berkas ditolak: ukuran harus lebih dari 0 dan maksimal 10 MB.");
      return;
    }
    const signature = new Uint8Array(await file.slice(0, 4).arrayBuffer());
    const isZipContainer = signature[0] === 0x50 && signature[1] === 0x4b && signature[2] === 0x03 && signature[3] === 0x04;
    if (!isZipContainer) {
      notify("Berkas ditolak: signature kontainer DOCX tidak valid.");
      return;
    }
    setUploadedFile(file.name);
    notify(`${file.name} lolos pemeriksaan lokal awal; belum diunggah atau diproses.`);
  }

  function focusPageHeading() {
    window.requestAnimationFrame(() => {
      document.querySelector<HTMLElement>("#main-content h1")?.focus();
    });
  }

  function navigate(next: NavigationItemId) {
    const allowed = navSections.some((section) => section.items.some((item) => item.id === next));
    const target = allowed ? next : "dashboard";
    setScreen(target);
    setWorkspaceCourse(null);
    setTeachingView("courses");
    setStudentRps(null);
    setMonitoringRecord(null);
    setSidebarOpen(false);
    setQuery("");
    const nextUrl = target === "dashboard" ? window.location.pathname : `${window.location.pathname}#${target}`;
    window.history.pushState(null, "", nextUrl);
    focusPageHeading();
  }

  function changeRole(next: RoleId) {
    if (!availableRoles.includes(next)) return;
    setRole(next);
    setScreen("dashboard");
    setWorkspaceCourse(null);
    setStudentRps(null);
    setMonitoringRecord(null);
    setWorkspaceTab("rps");
    setTeachingView("courses");
    setSidebarOpen(false);
    setQuery("");
    window.history.replaceState(null, "", window.location.pathname);
    notify(`Peran ${getRoleDefinition(next).shortLabel} aktif.`);
    focusPageHeading();
  }

  function navigateFromHref(href: string, targetId?: string) {
    const target = href.replace(/^#/, "") as NavigationItemId;
    if (target === "pengajaran-saya") {
      const defaultTab: WorkspaceTabId = targetId === courseWorkspace.courseOfferingId ? "pelaksanaan" : "rps";
      navigateTeaching(defaultTab, targetId ?? null);
      return;
    }
    navigate(target || "dashboard");
    if (target === "monitoring-rps" && targetId) setMonitoringRecord(targetId);
    if (target === "rps-saya" && targetId) setStudentRps(targetId);
  }

  function navigateTeaching(next: TeachingSubnavigationId, courseId: string | null = workspaceCourse) {
    const validCourseId = courseOfferings.some((course) => course.id === courseId) ? courseId : null;
    setScreen("pengajaran-saya");
    setTeachingView(next);
    setStudentRps(null);
    setMonitoringRecord(null);
    setSidebarOpen(false);
    setQuery("");
    if (next === "courses") {
      setWorkspaceCourse(null);
      window.history.pushState(null, "", `${window.location.pathname}#pengajaran-saya`);
    } else {
      setWorkspaceCourse(validCourseId);
      setWorkspaceTab(next);
      window.history.pushState(null, "", `${window.location.pathname}#pengajaran-saya/${validCourseId ?? "pilih-mata-kuliah"}/${next}`);
    }
    focusPageHeading();
  }

  function openTeachingCourse(courseId: string, requestedTab?: WorkspaceTabId) {
    const nextTab = requestedTab ?? (teachingView === "courses" ? "rps" : teachingView);
    navigateTeaching(nextTab, courseId);
  }

  function getTeachingSubmenuStatus(id: TeachingSubnavigationId): { label?: string; tone: Tone } {
    if (id === "courses") return { label: `${courseOfferings.slice(0, 3).length} kelas`, tone: "neutral" };
    const course = courseOfferings.find((item) => item.id === workspaceCourse);
    if (!course) return { label: "Pilih MK", tone: "neutral" };
    if (id === "rps") return { label: `${course.rpsProgress}%`, tone: course.rpsProgress === 100 ? "green" : course.rpsProgress >= 80 ? "amber" : "red" };
    if (id === "pelaksanaan") {
      return course.id === courseWorkspace.courseOfferingId
        ? { label: `${courseWorkspace.pelaksanaan.completedMeetings}/${courseWorkspace.pelaksanaan.totalMeetings}`, tone: "teal" }
        : { label: `${course.deliveryProgress}%`, tone: "teal" };
    }
    if (id === "evaluasi") return course.evaluationProgress ? { label: `${course.evaluationProgress}%`, tone: "purple" } : { label: "Belum dibuka", tone: "amber" };
    return { tone: "neutral" };
  }

  function openWorkflowTarget(code: string, rowId: string) {
    if (role === "mahasiswa") {
      navigateFromHref("#rps-saya", rowId);
      return;
    }
    if (role === "dosen") {
      const course = courseOfferings.find((item) => item.code === code);
      navigateFromHref("#pengajaran-saya", course?.id);
      return;
    }
    const record = rpsRecords.find((item) => item.code === code);
    navigateFromHref("#monitoring-rps", record?.id);
  }

  function openMobileNavigation() {
    setSidebarOpen(true);
    window.requestAnimationFrame(() => sidebarRef.current?.querySelector<HTMLButtonElement>("nav button")?.focus());
  }

  function closeMobileNavigation(returnFocus = true) {
    setSidebarOpen(false);
    if (returnFocus) window.requestAnimationFrame(() => menuButtonRef.current?.focus());
  }

  function handleSidebarKeyDown(event: React.KeyboardEvent<HTMLElement>) {
    if (!isMobile || !sidebarOpen) return;
    if (event.key === "Escape") {
      event.preventDefault();
      closeMobileNavigation();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = Array.from(sidebarRef.current?.querySelectorAll<HTMLElement>("a[href], button:not([disabled]), select, input") ?? []);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function renderDashboard() {
    const invitedUserCount = managedUsers.filter((user) => user.status === "invited").length;
    const dashboardActions = role === "admin"
      ? dashboard.actions.map((action) => action.id === "adm-2"
        ? {
            ...action,
            title: invitedUserCount
              ? `${invitedUserCount} undangan belum diselesaikan`
              : "Tidak ada undangan tertunda",
            description: invitedUserCount
              ? "Kirim ulang tautan onboarding atau arsipkan akun yang tidak lagi diperlukan."
              : "Semua undangan akun sudah ditindaklanjuti.",
          }
        : action)
      : dashboard.actions;

    return (
      <>
        <PageHeading eyebrow={dashboard.eyebrow} title={dashboard.title} description={dashboard.description} />

        <section aria-label="Perlu tindakan Anda" className={styles.section}>
          <SectionHeading title="Perlu tindakan Anda" description="Urutan berdasarkan risiko, tenggat, dan ruang lingkup peran aktif." />
          <div className={styles.actionGrid}>
            {dashboardActions.map((action) => (
              <article className={cx(styles.card, styles.actionCard, priorityClass(action.priority))} key={action.id}>
                <div className={styles.actionTop}>
                  <StatusBadge label={action.dueLabel} tone={action.priority === "critical" ? "red" : action.priority === "high" ? "amber" : "blue"} />
                  <span>{action.context}</span>
                </div>
                <h3>{action.title}</h3>
                <p>{action.description}</p>
                <button className={styles.textButton} onClick={() => navigateFromHref(action.href, action.targetId)} type="button">{action.actionLabel} <span aria-hidden="true">→</span></button>
              </article>
            ))}
          </div>
        </section>

        <section aria-label="Ringkasan" className={styles.metricGrid}>
          {dashboard.metrics.map((metric) => (
            <article className={styles.metricCard} key={metric.id}>
              <div className={cx(styles.metricIcon, toneClass(metric.tone))}><Icon name={metric.icon} /></div>
              <div className={styles.metricValue}>{role === "admin" && metric.id === "users" ? managedUsers.filter((user) => user.status === "active").length : metric.value}</div>
              <div className={styles.metricLabel}>{metric.label}</div>
              <p>{role === "admin" && metric.id === "users" ? `${managedUsers.filter((user) => user.status === "invited").length} undangan menunggu` : metric.detail}</p>
              {metric.trend && !(role === "admin" && metric.id === "users") ? <span className={styles.trend}>{metric.trend}</span> : null}
            </article>
          ))}
        </section>

        <div className={styles.contentGrid}>
          <section className={cx(styles.card, styles.spanTwo)}>
            <SectionHeading title={dashboard.workflowTitle} description={dashboard.workflowDescription} />
            <div className={styles.workflowList}>
              {dashboard.workflow.map((row) => (
                <article className={styles.workflowRow} key={row.id}>
                  <div className={styles.courseCode}>{row.code}</div>
                  <div className={styles.workflowMain}>
                    <div className={styles.rowTitle}><strong>{row.title}</strong><StatusBadge label={row.statusLabel} tone={workflowTones[row.status]} /></div>
                    <p>{row.owner} · {row.meta}</p>
                    <Progress value={row.progress} tone={workflowTones[row.status]} />
                  </div>
                  <div className={styles.rowActions}>
                    {row.issueCount > 0 ? <span className={styles.issueCount}>{row.issueCount} perhatian</span> : <span className={styles.completeText}>Siap</span>}
                    <button className={styles.secondaryButton} onClick={() => openWorkflowTarget(row.code, row.id)} type="button">{row.actionLabel}</button>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <aside className={styles.stack}>
            <section className={styles.card}>
              <SectionHeading title="Periode aktif" />
              <div className={styles.periodCard}>
                <span className={styles.periodMark}>26</span>
                <div><strong>{academicPeriods[0].label}</strong><p>17 Agu–19 Des 2026</p></div>
              </div>
              <div className={styles.miniTimeline}>
                {academicWindows.slice(1, 4).map((window) => {
                  const lockMode = lockModes[window.id];
                  const lockLabel = lockOptions.find((item) => item.value === lockMode)?.label ?? window.lockLabel;
                  return <div key={window.id}><i className={cx(styles.timelineDot, toneClass(lockMode === "open" ? "green" : "amber"))} /><span><strong>{window.title}</strong><small>{lockLabel} · {window.deadlineAt}</small></span></div>;
                })}
              </div>
            </section>
            {role === "admin" ? (
              <section className={styles.card}>
                <SectionHeading title="Kesehatan sistem" action={<button className={styles.textButton} onClick={() => navigate("ai-parser")} type="button">Detail</button>} />
                <div className={styles.serviceMiniList}>
                  {systemServices.map((service) => <div key={service.id}><i className={cx(styles.serviceDot, styles[`service_${service.status}`])} /><span>{service.name}</span><strong>{service.statusLabel}</strong></div>)}
                </div>
              </section>
            ) : null}
          </aside>
        </div>
      </>
    );
  }

  function renderPeriods() {
    const institution = institutions[0];
    const canManageCalendar = role === "admin";
    return (
      <>
        <PageHeading
          eyebrow="Administrasi akademik"
          title="Institusi & Periode"
          description={canManageCalendar ? "Atur struktur institusi, semester aktif, jendela aktivitas, dan kebijakan penguncian dari satu tempat." : "Pantau kalender akademik prodi dan kelola penugasan; penguncian periode hanya dapat diubah Admin."}
          action={canManageCalendar ? <button className={styles.primaryButton} onClick={() => notify("Simulasi MVP—form periode belum tersimpan ke backend.")} type="button"><Icon name="calendar" /> Simulasikan periode</button> : <StatusBadge label="Kalender read-only" tone="blue" />}
        />
        <section className={styles.metricGrid}>
          <article className={styles.metricCard}><div className={cx(styles.metricIcon, toneClass("blue"))}><Icon name="building" /></div><div className={styles.metricValue}>{institution.programCount}</div><div className={styles.metricLabel}>Program studi</div><p>{institution.name}</p></article>
          <article className={styles.metricCard}><div className={cx(styles.metricIcon, toneClass("green"))}><Icon name="calendar" /></div><div className={styles.metricValue}>1</div><div className={styles.metricLabel}>Periode aktif</div><p>{academicPeriods[0].label}</p></article>
          <article className={styles.metricCard}><div className={cx(styles.metricIcon, toneClass("amber"))}><Icon name="clock" /></div><div className={styles.metricValue}>{academicWindows.filter((window) => lockModes[window.id] === "open").length}</div><div className={styles.metricLabel}>Jendela dibuka</div><p>6 tahap workflow akademik</p></article>
          <article className={styles.metricCard}><div className={cx(styles.metricIcon, toneClass("red"))}><Icon name="shield" /></div><div className={styles.metricValue}>{academicWindows.reduce((sum, window) => sum + window.exceptionCount, 0)}</div><div className={styles.metricLabel}>Pengecualian aktif</div><p>Seluruh perubahan diaudit</p></article>
        </section>
        <section className={styles.card}>
          <SectionHeading title="Kalender & penguncian" description={canManageCalendar ? "Perubahan pada MVP bersifat pratinjau lokal dan kembali ke nilai awal setelah refresh." : "Kaprodi melihat jadwal dan pengecualian dalam lingkup prodi tanpa hak mengubah mode kunci."} />
          <div className={styles.windowList}>
            {academicWindows.map((window: AcademicWindow) => (
              <article className={styles.windowRow} key={window.id}>
                <div className={styles.windowIcon}><Icon name={window.stage === "teaching" ? "book-open" : window.stage === "evaluation" ? "chart" : "calendar"} /></div>
                <div className={styles.windowMain}>
                  <div className={styles.rowTitle}><strong>{window.title}</strong><StatusBadge label={lockOptions.find((item) => item.value === lockModes[window.id])?.label ?? window.lockLabel} tone={lockModes[window.id] === "open" ? "green" : lockModes[window.id] === "hard-lock" ? "red" : "amber"} /></div>
                  <p>{window.description}</p>
                  <small>{window.startsAt} → {window.deadlineAt} · {window.audience.map((item) => getRoleDefinition(item).shortLabel).join(", ")}</small>
                </div>
                <div className={styles.windowControls}>
                  {canManageCalendar ? <label><span className={styles.srOnly}>Mode kunci {window.title}</span><select value={lockModes[window.id]} onChange={(event) => { setLockModes((current) => ({ ...current, [window.id]: event.target.value as LockMode })); notify(`Simulasi—mode ${window.title} berubah lokal dan belum disimpan.`); }}>{lockOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label> : null}
                  <button className={styles.secondaryButton} onClick={() => notify(`${window.title}: contoh ${window.exceptionCount} pengecualian tercatat.`)} type="button">Lihat pengecualian {window.exceptionCount || ""}</button>
                </div>
              </article>
            ))}
          </div>
        </section>
        <section className={styles.card}>
          <SectionHeading title="Penugasan pengajaran" description="Ringkasan kelas yang sudah memiliki dosen penanggung jawab." action={<button className={styles.secondaryButton} onClick={() => notify("Simulasi MVP—form penugasan belum tersimpan ke backend.")} type="button">Simulasikan penugasan</button>} />
          <div className={styles.compactCourseGrid}>{courseOfferings.map((course) => <article key={course.id}><span className={styles.courseCode}>{course.code}</span><div><strong>{course.name} · {course.className}</strong><p>{course.lecturer} · {course.studentCount} mahasiswa</p></div><StatusBadge label={course.statusLabel} tone={course.status === "attention" ? "red" : course.status === "review" ? "amber" : "green"} /></article>)}</div>
        </section>
      </>
    );
  }

  function renderUsers() {
    return <UserManagementPanel users={managedUsers} query={query} onQueryChange={setQuery} onUsersChange={setManagedUsers} notify={notify} />;
  }

  function renderMonitoring() {
    const selectedRecord = rpsRecords.find((record) => record.id === monitoringRecord);
    if (selectedRecord) {
      const canReview = role === "gpm" && selectedRecord.status === "gpm-review";
      const canApprove = role === "kaprodi" && selectedRecord.status === "head-approval";
      const localDecision = reviewDecisions[selectedRecord.id];
      return (
        <>
          <button className={styles.backButton} onClick={() => setMonitoringRecord(null)} type="button">← Kembali ke monitoring</button>
          <PageHeading
            eyebrow={`${roleDefinition.shortLabel} · Detail sesuai lingkup`}
            title={`${selectedRecord.code} · ${selectedRecord.courseName}`}
            description={`${selectedRecord.owner} · ${selectedRecord.period} · RPS v${selectedRecord.version}`}
            action={<StatusBadge label={localDecision ?? selectedRecord.statusLabel} tone={localDecision ? "blue" : workflowTones[selectedRecord.status]} />}
          />
          <div className={styles.contentGrid}>
            <section className={cx(styles.card, styles.spanTwo)}>
              <SectionHeading title="Ringkasan pemeriksaan" description="Detail ini memakai data contoh; keputusan hanya disimpan pada state lokal selama sesi pratinjau." />
              <dl className={styles.definitionList}>
                <div><dt>Kesiapan</dt><dd>{selectedRecord.readiness}%</dd></div>
                <div><dt>Temuan terbuka</dt><dd>{selectedRecord.issues}</dd></div>
                <div><dt>Reviewer</dt><dd>{selectedRecord.reviewer}</dd></div>
                <div><dt>Tenggat</dt><dd>{selectedRecord.dueAt}</dd></div>
              </dl>
              <Progress label="Validation gate" tone={selectedRecord.readiness === 100 ? "green" : "amber"} value={selectedRecord.readiness} />
            </section>
            <aside className={styles.card}>
              <SectionHeading title={role === "gpm" ? "Keputusan mutu" : role === "kaprodi" ? "Keputusan Kaprodi" : "Pantauan Admin"} />
              {canReview ? <><p className={styles.privacyNote}>GPM dapat meloloskan review atau meminta revisi, tetapi tidak mengubah isi dan tidak menerbitkan RPS.</p><div className={styles.workspaceActions}><button className={styles.secondaryButton} onClick={() => { setReviewDecisions((current) => ({ ...current, [selectedRecord.id]: "Revisi diminta · simulasi" })); notify("Simulasi—permintaan revisi belum dikirim ke backend."); }} type="button">Minta revisi</button><button className={styles.primaryButton} onClick={() => { setReviewDecisions((current) => ({ ...current, [selectedRecord.id]: "Lolos GPM · simulasi" })); notify("Simulasi—hasil review belum disimpan ke backend."); }} type="button">Loloskan review</button></div></> : null}
              {canApprove ? <><p className={styles.privacyNote}>Kaprodi memutuskan versi yang telah lolos GPM. Publikasi tidak dapat dilakukan oleh GPM atau Admin.</p><div className={styles.workspaceActions}><button className={styles.secondaryButton} onClick={() => { setReviewDecisions((current) => ({ ...current, [selectedRecord.id]: "Revisi diminta · simulasi" })); notify("Simulasi—permintaan revisi belum dikirim ke backend."); }} type="button">Minta revisi</button><button className={styles.primaryButton} onClick={() => { setReviewDecisions((current) => ({ ...current, [selectedRecord.id]: "Disahkan · simulasi" })); notify("Simulasi—RPS belum disahkan atau dipublikasikan di backend."); }} type="button">Sahkan versi</button></div></> : null}
              {!canReview && !canApprove ? <p className={styles.privacyNote}>{role === "admin" ? "Admin memantau status dan audit tanpa mengambil keputusan akademik." : `Tidak ada keputusan ${roleDefinition.shortLabel} yang sah pada status ${selectedRecord.statusLabel}.`}</p> : null}
            </aside>
          </div>
        </>
      );
    }

    const scopedRecords = role === "gpm"
      ? rpsRecords.filter((record) => ["gpm-review", "revision", "head-approval"].includes(record.status))
      : rpsRecords;
    const filtered = scopedRecords.filter((record) => {
      const matchesQuery = `${record.code} ${record.courseName} ${record.owner} ${record.reviewer}`.toLowerCase().includes(query.toLowerCase());
      return matchesQuery && (statusFilter === "all" || record.status === statusFilter);
    });
    return (
      <>
        <PageHeading eyebrow="Curriculum intelligence · Level 3" title="Monitoring RPS" description={`Pantau workflow dan alignment ${role === "admin" ? "lintas institusi" : role === "kaprodi" ? "S-1 Informatika" : "pada antrian review yang ditugaskan"}.`} action={<button className={styles.secondaryButton} onClick={() => notify("Simulasi ekspor—belum ada file yang dibuat.")} type="button">Simulasikan ekspor</button>} />
        <div className={styles.insightGrid}>
          <article className={cx(styles.card, styles.insightHero)}><p className={styles.eyebrow}>Kesehatan kurikulum</p><strong>84</strong><span>/100</span><p>Cakupan CPL baik; penguasaan akhir CPL-05 masih perlu diperkuat.</p></article>
          <article className={styles.card}><SectionHeading title="CPL coverage" /><Progress label="CPL-01 · Dasar keilmuan" tone="green" value={94} /><Progress label="CPL-03 · Pemecahan masalah" tone="teal" value={88} /><Progress label="CPL-05 · Profesionalisme" tone="amber" value={63} /></article>
          <article className={styles.card}><SectionHeading title="Temuan utama" /><ul className={styles.findingList}><li><StatusBadge label="Gap" tone="red" /> CPL-05 belum muncul pada level mastery.</li><li><StatusBadge label="Caution" tone="amber" /> 4 rubrik belum mengukur CPMK langsung.</li><li><StatusBadge label="Baik" tone="green" /> Progression I–R–M konsisten pada 7 CPL.</li></ul></article>
        </div>
        <section className={styles.card}>
          <div className={styles.toolbar}>
            <label className={styles.searchField}><Icon name="monitor" /><span className={styles.srOnly}>Cari RPS</span><input onChange={(event) => setQuery(event.target.value)} placeholder="Cari mata kuliah, dosen, atau reviewer…" type="search" value={query} /></label>
            <label><span className={styles.srOnly}>Filter status</span><select onChange={(event) => setStatusFilter(event.target.value)} value={statusFilter}><option value="all">Semua status</option><option value="draft">Draft</option><option value="gpm-review">Review GPM</option><option value="revision">Revisi</option><option value="head-approval">Pengesahan</option><option value="published">Terbit</option></select></label>
            <span className={styles.resultCount}>{filtered.length} RPS</span>
          </div>
          <div className={styles.tableWrap}>
            <table><thead><tr><th>Mata kuliah</th><th>Penanggung jawab</th><th>Status</th><th>Kesiapan</th><th>Reviewer</th><th>Tenggat</th><th><span className={styles.srOnly}>Tindakan</span></th></tr></thead><tbody>{filtered.map((record) => {
              const actionLabel = role === "gpm" && record.status === "gpm-review" ? "Review" : role === "kaprodi" && record.status === "head-approval" ? "Putuskan" : "Lihat";
              return <tr key={record.id}><td><strong>{record.code} · {record.courseName}</strong><small>{record.period} · v{record.version}</small></td><td>{record.owner}</td><td><StatusBadge label={reviewDecisions[record.id] ?? record.statusLabel} tone={reviewDecisions[record.id] ? "blue" : workflowTones[record.status]} />{record.issues ? <small className={styles.warningText}>{record.issues} perhatian</small> : null}</td><td><Progress value={record.readiness} tone={record.readiness === 100 ? "green" : record.readiness >= 90 ? "amber" : "red"} /></td><td>{record.reviewer}</td><td><strong>{record.dueAt}</strong><small>Diperbarui {record.updatedAt}</small></td><td><button className={styles.secondaryButton} onClick={() => { setMonitoringRecord(record.id); focusPageHeading(); }} type="button">{actionLabel}</button></td></tr>;
            })}</tbody></table>
          </div>
        </section>
      </>
    );
  }

  function renderWorkspace() {
    const selected = courseOfferings.find((course) => course.id === workspaceCourse);
    if (!selected) {
      const isChoosingForSubmenu = teachingView !== "courses";
      return (
        <>
          <PageHeading
            eyebrow="Workspace dosen · Level 2 + Level 4"
            title={isChoosingForSubmenu ? `Pilih mata kuliah untuk ${activeTeachingItem?.label ?? "workspace"}` : "Pengajaran Saya"}
            description={isChoosingForSubmenu ? "Konteks mata kuliah wajib dipilih agar data RPS, pelaksanaan, evaluasi, dan riwayat tidak tercampur." : "Hanya mata kuliah yang ditugaskan kepada persona Dosen ini; progres RPS, pelaksanaan, dan evaluasi dipisahkan."}
          />
          {isChoosingForSubmenu ? <div className={styles.selectionNotice}><Icon name="shield" /><div><strong>Pilih mata kuliah terlebih dahulu</strong><span>Setelah dipilih, Anda langsung masuk ke submenu {activeTeachingItem?.label}.</span></div></div> : null}
          <div className={styles.courseGrid}>{courseOfferings.slice(0, 3).map((course) => <article className={styles.courseCard} key={course.id}><div className={styles.courseCardTop}><span className={styles.courseCode}>{course.code}</span><StatusBadge label={course.statusLabel} tone={course.status === "attention" ? "red" : course.status === "review" ? "amber" : "green"} /></div><h2>{course.name}</h2><p>Kelas {course.className} · {course.credits} SKS · {course.studentCount} mahasiswa</p><div className={styles.threeProgress}><Progress label="RPS" tone={course.rpsProgress === 100 ? "green" : "amber"} value={course.rpsProgress} /><Progress label="Pelaksanaan" tone="teal" value={course.deliveryProgress} /><Progress label="Evaluasi" tone="purple" value={course.evaluationProgress} /></div><div className={styles.courseNext}><span><small>Tindakan berikutnya</small><strong>{course.nextAction}</strong></span><StatusBadge label={course.dueLabel} tone={course.status === "attention" ? "red" : "blue"} /></div><button className={styles.primaryButton} onClick={() => openTeachingCourse(course.id)} type="button">{isChoosingForSubmenu ? `Buka ${activeTeachingItem?.label}` : "Buka workspace"} <span aria-hidden="true">→</span></button></article>)}</div>
        </>
      );
    }
    if (selected.id !== courseWorkspace.courseOfferingId) {
      const currentRps = rpsRecords.find((record) => record.courseOfferingId === selected.id);
      const effectiveRps = publicRpsDetails[selected.code];
      return (
        <>
          <button className={styles.backButton} onClick={() => navigateTeaching("courses")} type="button">← Semua pengajaran</button>
          <PageHeading
            eyebrow={`Workspace dosen · ${activeTeachingItem?.label ?? "Ringkasan mata kuliah"}`}
            title={`${selected.code} · ${selected.name}`}
            description={`Kelas ${selected.className} · ${selected.credits} SKS · ${selected.studentCount} mahasiswa · konteks ${activeTeachingItem?.label ?? "workspace"}`}
            action={<StatusBadge label={selected.statusLabel} tone={selected.status === "attention" ? "red" : selected.status === "review" ? "amber" : "green"} />}
          />
          <section className={styles.metricGrid}>
            <article className={styles.metricCard}><div className={cx(styles.metricIcon, toneClass("amber"))}><Icon name="file-text" /></div><div className={styles.metricValue}>{selected.rpsProgress}%</div><div className={styles.metricLabel}>Penyusunan RPS</div><p>{currentRps ? `v${currentRps.version} · ${currentRps.statusLabel}` : "Belum ada dokumen"}</p></article>
            <article className={styles.metricCard}><div className={cx(styles.metricIcon, toneClass("teal"))}><Icon name="calendar" /></div><div className={styles.metricValue}>{selected.deliveryProgress}%</div><div className={styles.metricLabel}>Pelaksanaan</div><p>Progres kelas aktif</p></article>
            <article className={styles.metricCard}><div className={cx(styles.metricIcon, toneClass("purple"))}><Icon name="chart" /></div><div className={styles.metricValue}>{selected.evaluationProgress}%</div><div className={styles.metricLabel}>Evaluasi</div><p>Menunggu jendela evaluasi</p></article>
            <article className={styles.metricCard}><div className={cx(styles.metricIcon, toneClass("blue"))}><Icon name="book-open" /></div><div className={styles.metricValue}>{effectiveRps ? `v${effectiveRps.version}` : "—"}</div><div className={styles.metricLabel}>Versi efektif</div><p>{effectiveRps ? "Tersedia read-only untuk mahasiswa" : "Belum dipublikasikan"}</p></article>
          </section>
          <div className={styles.contentGrid}>
            <section className={cx(styles.card, styles.spanTwo)}><SectionHeading title={activeTeachingItem?.label ?? "Tindakan berikutnya"} description={`Data detail ${activeTeachingItem?.label ?? "workspace"} untuk ${selected.code} belum dimodelkan; contoh lengkap tersedia pada IF306 tanpa mendaur ulang isi mata kuliah lain.`} /><h2>{selected.nextAction}</h2><p className={styles.privacyNote}>Aksi pada MVP ini hanya mendemonstrasikan alur dan belum mengubah dokumen di backend.</p><button className={styles.primaryButton} onClick={() => notify(`Simulasi—aksi ${selected.code} belum disimpan ke backend.`)} type="button">Simulasikan tindakan</button></section>
            <aside className={styles.card}><SectionHeading title="Batas fixture" /><p className={styles.privacyNote}>Konten detail unik untuk {selected.code} belum dimodelkan. Karena itu aplikasi tidak mendaur ulang CPMK atau bukti IF306 secara keliru.</p></aside>
          </div>
        </>
      );
    }
    const workspace = courseWorkspace;
    const measuredOutcomes = workspace.evaluasi.outcomes.filter((outcome) => typeof outcome.attainment === "number");
    const classAttainment = Math.round(measuredOutcomes.reduce((sum, outcome) => sum + (outcome.attainment ?? 0), 0) / measuredOutcomes.length);
    const achievedOutcomes = measuredOutcomes.filter((outcome) => (outcome.attainment ?? 0) >= (outcome.target ?? 0)).length;
    return (
      <>
        <button className={styles.backButton} onClick={() => navigateTeaching("courses")} type="button">← Semua pengajaran</button>
        <div className={styles.workspaceHeader}>
          <div><div className={styles.workspaceTitleRow}><span className={styles.courseCode}>{selected.code}</span><StatusBadge label="RPS v3 · Menunggu Kaprodi" tone="amber" /></div><h1 tabIndex={-1}>{selected.name}</h1><p>Kelas {selected.className} · {selected.credits} SKS · {selected.program} · Pelaksanaan memakai versi efektif v2</p></div>
          <div className={styles.workspaceActions}>
            {workspaceTab === "rps" ? <><button className={styles.secondaryButton} onClick={() => notify("Simulasi—perbandingan v2 ↔ v3 belum membuka diff persisten.")} type="button"><Icon name="history" /> Simulasikan diff</button><button className={styles.primaryButton} onClick={() => notify("Simulasi—perubahan belum disimpan ke backend.")} type="button">Simulasikan simpan</button></> : null}
            {workspaceTab === "pelaksanaan" ? <StatusBadge label="Versi efektif v2" tone="teal" /> : null}
            {workspaceTab === "evaluasi" ? <StatusBadge label="Contoh historis · read-only" tone="blue" /> : null}
            {workspaceTab === "riwayat" ? <StatusBadge label="Jejak immutable" tone="neutral" /> : null}
          </div>
        </div>
        {workspaceTab === "rps" ? (
          <RpsAuthoringPanel onFileSelected={handleRpsFileSelected} onNotify={notify} uploadedFile={uploadedFile} />
        ) : null}
        {workspaceTab === "pelaksanaan" ? (
          <div className={styles.workspaceGrid}><section className={cx(styles.card, styles.fullWidth)}><SectionHeading title="Realisasi perkuliahan · versi efektif v2" description={`${workspace.pelaksanaan.completedMeetings} dari ${workspace.pelaksanaan.totalMeetings} pertemuan tercatat · ${workspace.pelaksanaan.deviationCount} deviasi rencana`} action={<button className={styles.primaryButton} onClick={() => notify("Simulasi—form realisasi belum disimpan ke backend.")} type="button">Simulasikan catatan</button>} /><div className={styles.tableWrap}><table><thead><tr><th>Minggu</th><th>Rencana RPS</th><th>Realisasi</th><th>Bukti</th><th>Status</th></tr></thead><tbody>{workspace.pelaksanaan.meetings.map((meeting) => <tr key={meeting.week}><td><strong>{meeting.week}</strong></td><td>{meeting.plan}</td><td>{meeting.realization}</td><td>{meeting.evidence}</td><td><StatusBadge label={meeting.status === "done" ? "Sesuai" : meeting.status === "changed" ? "Ada deviasi" : "Akan datang"} tone={meeting.status === "done" ? "green" : meeting.status === "changed" ? "amber" : "neutral"} /></td></tr>)}</tbody></table></div></section></div>
        ) : null}
        {workspaceTab === "evaluasi" ? (
          <div className={styles.workspaceGrid}><section className={cx(styles.card, styles.fullWidth)}><StatusBadge label="Contoh historis · read-only" tone="blue" /><p className={styles.privacyNote}>Jendela evaluasi periode aktif belum dibuka. Angka berikut hanya mendemonstrasikan struktur Level 4 memakai fixture semester sebelumnya dan tidak dapat diubah.</p></section><section className={styles.card}><SectionHeading title="Ketercapaian kelas" /><div className={styles.attainmentHero}><strong>{classAttainment}%</strong><span>Target umum 75%</span></div><div className={styles.evaluationStats}><div><strong>{achievedOutcomes}/{measuredOutcomes.length}</strong><span>CPMK tercapai</span></div><div><strong>{workspace.evaluasi.criticalGaps}</strong><span>Gap kritis</span></div></div></section><section className={cx(styles.card, styles.spanTwo)}><SectionHeading title="Ketercapaian CPMK" description="Closed-loop OBE dari Level 4; nilai ringkasan diturunkan dari fixture outcome di bawah." /><div className={styles.attainmentList}>{workspace.evaluasi.outcomes.map((outcome) => <article key={outcome.code}><div><strong>{outcome.code}</strong><span>{outcome.statement}</span></div><Progress value={outcome.attainment ?? 0} tone={outcome.status === "achieved" ? "green" : outcome.status === "gap" ? "red" : "amber"} /><small>Target {outcome.target}%</small></article>)}</div></section><section className={cx(styles.card, styles.fullWidth)}><SectionHeading title="Tindakan perbaikan" description="Contoh temuan historis sebagai masukan RPS berikutnya; tidak ada command aktif pada periode ini." /><div className={styles.improvementGrid}>{workspace.evaluasi.improvements.map((item) => <article key={item.id}><StatusBadge label={item.status === "planned" ? "Direncanakan" : item.status === "in-progress" ? "Dikerjakan" : "Selesai"} tone={item.status === "planned" ? "blue" : item.status === "in-progress" ? "amber" : "green"} /><h3>{item.finding}</h3><p><strong>Akar masalah:</strong> {item.rootCause}</p><p><strong>Aksi:</strong> {item.action}</p><small>{item.owner} · {item.dueLabel}</small></article>)}</div></section></div>
        ) : null}
        {workspaceTab === "riwayat" ? (
          <section className={styles.card}><SectionHeading title="Versi, review, dan keputusan" description="Riwayat akademik yang mudah dipahami; audit teknis tetap berada pada Audit Log." /><div className={styles.historyList}>{workspace.riwayat.map((entry) => <article key={entry.id}><i className={toneClass(entry.tone)} /><div><div className={styles.rowTitle}><strong>{entry.title}</strong><span>{entry.timestamp}</span></div><p>{entry.detail}</p><small>{entry.actor}</small></div></article>)}</div></section>
        ) : null}
      </>
    );
  }

  function renderStudentRps() {
    const rows = roleDashboards.mahasiswa.workflow;
    const selected = rows.find((row) => row.id === studentRps);
    if (selected) {
      const detail = publicRpsDetails[selected.code];
      if (!detail) return <><button className={styles.backButton} onClick={() => setStudentRps(null)} type="button">← Semua RPS</button><PageHeading eyebrow="Portal mahasiswa" title="RPS belum tersedia" description="Proyeksi publik untuk mata kuliah ini belum dimuat pada fixture MVP." /></>;
      return <><button className={styles.backButton} onClick={() => setStudentRps(null)} type="button">← Semua RPS</button><PageHeading eyebrow="Versi efektif · Read-only" title={`${selected.code} · ${selected.title}`} description={`${selected.owner} · ${selected.meta}. Versi baru yang masih direview tidak terlihat di portal mahasiswa.`} action={<button className={styles.primaryButton} onClick={() => notify("Simulasi unduh—PDF belum dibuat.")} type="button">Simulasikan PDF</button>} /><div className={styles.studentGrid}><section className={cx(styles.card, styles.spanTwo)}><SectionHeading title="Capaian pembelajaran" description={`Proyeksi publik RPS v${detail.version}`} />{detail.outcomes.map((outcome) => <article className={styles.publicOutcome} key={outcome.code}><span>{outcome.code}</span><p>{outcome.statement}</p></article>)}</section><aside className={styles.stack}><section className={styles.card}><SectionHeading title="Rencana asesmen" /><ul className={styles.assessmentList}>{detail.assessments.map((assessment) => <li key={assessment.title}><strong>{assessment.title}</strong><span>{assessment.weight}</span></li>)}</ul></section><section className={styles.card}><StatusBadge label="Proyeksi publik" tone="green" /><p className={styles.privacyNote}>Komentar reviewer, skor AI, audit internal, realisasi dosen, dan data mahasiswa lain tidak dikirim ke tampilan ini.</p></section></aside><section className={cx(styles.card, styles.fullWidth)}><SectionHeading title="Rencana pembelajaran" description="Hanya rencana yang disahkan; bukan jurnal realisasi internal dosen." /><div className={styles.tableWrap}><table><thead><tr><th>Minggu</th><th>Topik</th><th>Metode</th><th>Asesmen/bukti rencana</th></tr></thead><tbody>{detail.weeklyPlan.map((meeting) => <tr key={meeting.week}><td>{meeting.week}</td><td>{meeting.topic}</td><td>{meeting.method}</td><td>{meeting.evidence}</td></tr>)}</tbody></table></div></section></div></>;
    }
    return <><PageHeading eyebrow="Portal mahasiswa" title="RPS Saya" description="Akses outcome, rencana pertemuan, asesmen, dan referensi dari RPS yang sudah disahkan." /><div className={styles.studentRpsGrid}>{rows.map((row) => <article className={styles.studentRpsCard} key={row.id}><div className={styles.studentCardCover}><span>{row.code}</span><Icon name="book-open" size={28} /></div><div className={styles.studentCardBody}><div className={styles.rowTitle}><StatusBadge label={row.statusLabel} tone="green" /><small>{row.meta}</small></div><h2>{row.title}</h2><p>{row.owner}</p><div className={styles.studentCardActions}><button className={styles.primaryButton} onClick={() => { setStudentRps(row.id); focusPageHeading(); }} type="button">Buka RPS</button><button aria-label={`Simulasikan unduh ${row.title}`} className={styles.iconButton} onClick={() => notify(`Simulasi unduh ${row.title}—PDF belum dibuat.`)} type="button">↓</button></div></div></article>)}</div></>;
  }

  function renderAiParser() {
    return <><PageHeading eyebrow="Operasional platform · Data contoh" title="AI & Parser" description="Permukaan MVP untuk layanan ekstraksi dan AI; seluruh status di bawah adalah fixture, bukan telemetri produksi." /><div className={styles.serviceGrid}>{systemServices.map((service) => <article className={styles.serviceCard} key={service.id}><div className={styles.serviceCardTop}><div className={styles.serviceLogo}><Icon name={service.id === "ai" ? "sparkles" : service.id === "parser" ? "file-text" : service.id === "supabase" ? "activity" : "monitor"} /></div><StatusBadge label={service.statusLabel} tone={service.status === "healthy" ? "green" : service.status === "degraded" ? "amber" : "red"} /></div><h2>{service.name}</h2><p>{service.description}</p><div className={styles.serviceMeta}><strong>{service.metric}</strong><span>Sumber: {service.lastChecked}</span></div><button className={styles.secondaryButton} onClick={() => notify(`Simulasi—pemeriksaan ${service.name} tidak benar-benar dijalankan.`)} type="button">Simulasikan cek</button></article>)}</div><div className={styles.contentGrid}><section className={cx(styles.card, styles.spanTwo)}><SectionHeading title="Antrean parser" description="Contoh alur upload → parsing → ekstraksi → tinjau dengan status processing terpisah." /><div className={styles.queueList}>{parserJobs.map((job) => { const record = rpsRecords.find((item) => item.id === job.rpsId); return <article key={job.id}><div className={styles.queueIcon}><Icon name="file-text" /></div><div><strong>{record ? `${record.code} · ${record.courseName}` : job.fileName}</strong><p>{job.detail}</p></div><StatusBadge label={job.statusLabel} tone={job.tone} /><button className={styles.textButton} onClick={() => notify(`Simulasi—aksi ${job.actionLabel.toLowerCase()} belum menjalankan job parser.`)} type="button">{job.actionLabel}</button></article>; })}</div></section><aside className={styles.card}><SectionHeading title="Mode AI" description="Rules-only adalah default tanpa biaya." /><div className={styles.radioStack}><label><input checked={aiMode === "rules"} name="ai-mode" onChange={() => setAiMode("rules")} type="radio" /><span><strong>Rules-only</strong><small>Validasi deterministik, tanpa API eksternal</small></span></label><label><input checked={aiMode === "openai"} name="ai-mode" onChange={() => setAiMode("openai")} type="radio" /><span><strong>OpenAI</strong><small>Saran terjelaskan dengan batas biaya</small></span></label></div><button className={styles.primaryButton} onClick={() => notify(`Simulasi—mode ${aiMode === "rules" ? "rules-only" : "OpenAI"} belum disimpan ke backend.`)} type="button">Simulasikan simpan</button></aside></div></>;
  }

  function renderAudit() {
    const filtered = auditEntries.filter((entry) => `${entry.actor} ${entry.actorRole} ${entry.action} ${entry.target} ${entry.detail}`.toLowerCase().includes(query.toLowerCase()));
    return <><PageHeading eyebrow="Jejak kendali" title="Audit Log" description="Perubahan akses, workflow, AI, parser, dan penguncian dicatat sebagai jejak yang tidak dapat diedit." action={<button className={styles.secondaryButton} onClick={() => notify("Ekspor audit CSV disiapkan.")} type="button">Ekspor CSV</button>} /><section className={styles.card}><div className={styles.toolbar}><label className={styles.searchField}><Icon name="history" /><span className={styles.srOnly}>Cari audit</span><input onChange={(event) => setQuery(event.target.value)} placeholder="Cari pelaku, tindakan, atau target…" type="search" value={query} /></label><span className={styles.resultCount}>{filtered.length} aktivitas</span></div><div className={styles.auditList}>{filtered.map((entry) => <article key={entry.id}><div className={cx(styles.auditIcon, toneClass(entry.tone))}><Icon name="history" /></div><div><div className={styles.rowTitle}><strong>{entry.action}</strong><span>{entry.timestamp}</span></div><p>{entry.target}</p><small>{entry.actor} · {entry.actorRole} — {entry.detail}</small></div><button className={styles.textButton} onClick={() => notify(`Detail ${entry.id} dibuka.`)} type="button">Detail</button></article>)}</div></section></>;
  }

  function renderSettings() {
    const options: Array<{ key: keyof typeof settingsState; title: string; detail: string }> = [
      { key: "reminders", title: "Pengingat tenggat", detail: "Kirim pengingat 14, 7, 3, dan 1 hari sebelum tenggat." },
      { key: "autoLock", title: "Penguncian otomatis", detail: "Terapkan mode kunci sesuai kalender periode akademik." },
      { key: "digest", title: "Digest aktivitas harian", detail: "Ringkas perubahan RPS, review, dan pengecualian setiap pagi." },
      { key: "provenance", title: "Provenance wajib", detail: "Simpan sumber dokumen untuk setiap field hasil ekstraksi." },
    ];
    return <><PageHeading eyebrow="Konfigurasi platform" title="Pengaturan" description="Aturan MVP dikelompokkan agar mudah dipindahkan ke kebijakan institusi dan feature flag." /><div className={styles.settingsGrid}><section className={cx(styles.card, styles.spanTwo)}><SectionHeading title="Workflow & notifikasi" description="Toggle di bawah hanya mengubah state pratinjau." /><div className={styles.toggleList}>{options.map((option) => <label key={option.key}><span><strong>{option.title}</strong><small>{option.detail}</small></span><input checked={settingsState[option.key]} onChange={(event) => setSettingsState((current) => ({ ...current, [option.key]: event.target.checked }))} type="checkbox" /><i aria-hidden="true" /></label>)}</div><button className={styles.primaryButton} onClick={() => notify("Pengaturan tersimpan pada pratinjau.")} type="button">Simpan pengaturan</button></section><aside className={styles.card}><SectionHeading title="Identitas platform" /><dl className={styles.definitionList}><div><dt>Nama</dt><dd>OBELIKS APPS</dd></div><div><dt>Tagline</dt><dd>Platform Integrasi RPS</dd></div><div><dt>Zona waktu</dt><dd>Asia/Jakarta</dd></div><div><dt>Versi MVP</dt><dd>0.1 role dashboard</dd></div></dl><button className={styles.secondaryButton} onClick={() => notify("Editor identitas platform dibuka.")} type="button">Ubah identitas</button></aside></div></>;
  }

  function renderScreen() {
    switch (screen) {
      case "institusi-periode": return renderPeriods();
      case "pengguna-akses": return renderUsers();
      case "monitoring-rps": return renderMonitoring();
      case "pengajaran-saya": return renderWorkspace();
      case "rps-saya": return renderStudentRps();
      case "ai-parser": return renderAiParser();
      case "audit-log": return renderAudit();
      case "pengaturan": return renderSettings();
      default: return renderDashboard();
    }
  }

  return (
    <div className={styles.app}>
      <a className={styles.skipLink} href="#main-content">Lewati ke konten utama</a>
      {sidebarOpen && isMobile ? <button aria-label="Tutup navigasi" className={styles.overlay} onClick={() => closeMobileNavigation()} type="button" /> : null}
      <aside aria-hidden={isMobile && !sidebarOpen ? true : undefined} className={cx(styles.sidebar, sidebarOpen && styles.sidebarOpen)} id="app-sidebar" inert={isMobile && !sidebarOpen ? true : undefined} onKeyDown={handleSidebarKeyDown} ref={sidebarRef}>
        <div className={styles.brand}><div className={styles.brandMark}>OBE</div><div><strong>OBELIKS APPS</strong><span>Platform Integrasi RPS</span></div></div>
        <nav aria-label="Navigasi utama" className={styles.navigation}>
          {navSections.map((section) => (
            <div className={styles.navSection} key={section.id}>
              <p>{section.label}</p>
              {section.items.map((item) => item.id === "pengajaran-saya" && role === "dosen" ? (
                <div className={styles.navTree} key={item.id}>
                  <button
                    aria-controls="pengajaran-saya-submenu"
                    aria-expanded="true"
                    className={cx(styles.navItem, screen === item.id && styles.navParentActive)}
                    onClick={() => navigateTeaching("courses")}
                    title={item.description}
                    type="button"
                  >
                    <Icon name={item.icon} />
                    <span>{item.label}</span>
                    <i aria-hidden="true" className={styles.navChevron}>⌄</i>
                  </button>
                  <ul className={styles.navSubmenu} id="pengajaran-saya-submenu">
                    {teachingSubnavigation.map((subitem) => {
                      const isActive = screen === "pengajaran-saya" && teachingView === subitem.id;
                      const status = getTeachingSubmenuStatus(subitem.id);
                      return (
                        <li key={subitem.id}>
                          <button
                            aria-current={isActive ? "page" : undefined}
                            className={cx(styles.navSubitem, isActive && styles.navSubitemActive)}
                            onClick={() => navigateTeaching(subitem.id)}
                            title={subitem.description}
                            type="button"
                          >
                            <i aria-hidden="true" className={cx(styles.navStatusDot, toneClass(status.tone))} />
                            <span>{subitem.label}</span>
                            {status.label ? <em>{status.label}</em> : null}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : (
                <button aria-current={screen === item.id ? "page" : undefined} className={cx(styles.navItem, screen === item.id && styles.navItemActive)} key={item.id} onClick={() => navigate(item.id)} title={item.description} type="button"><Icon name={item.icon} /><span>{item.label}</span>{item.badge ? <em>{item.badge}</em> : null}</button>
              ))}
            </div>
          ))}
        </nav>
        <div className={styles.sidebarSpacer} />
        <div className={styles.sidebarContext}><span>Ruang kerja aktif</span><strong>{roleDefinition.scope}</strong><small>Gasal 2026/2027</small></div>
        <form action={signOutAction}><button className={styles.signOutButton} type="submit"><span className={styles.avatarSmall}>{(displayName || email).slice(0, 2).toUpperCase()}</span><span><strong>{displayName || "Superadmin"}</strong><small>Keluar dari aplikasi</small></span><span aria-hidden="true">↗</span></button></form>
      </aside>

      <div className={styles.mainShell}>
        <header className={styles.topbar}>
          <button aria-controls="app-sidebar" aria-expanded={sidebarOpen} aria-label={sidebarOpen ? "Navigasi terbuka" : "Buka navigasi"} className={styles.menuButton} onClick={openMobileNavigation} ref={menuButtonRef} type="button">☰</button>
          <div className={styles.breadcrumb}><span>OBELIKS</span><i>/</i><strong>{screen === "pengajaran-saya" ? activeTeachingItem?.label ?? activeNav?.label : activeNav?.label ?? "Dashboard"}</strong></div>
          <div className={styles.topbarSpacer} />
          <label className={styles.rolePreview}><span>Peran aktif</span><select aria-label="Peran aktif" disabled={availableRoles.length === 1} onChange={(event) => changeRole(event.target.value as RoleId)} value={role}>{roles.filter((item) => availableRoles.includes(item.id)).map((item) => <option key={item.id} value={item.id}>{item.shortLabel}</option>)}</select></label>
          <button aria-label="Notifikasi" className={styles.iconButton} onClick={() => notify(`${dashboard.actions.length} tindakan memerlukan perhatian.`)} type="button"><Icon name="alert-triangle" /><i /></button>
          <span className={styles.avatar}>{(displayName || email).slice(0, 2).toUpperCase()}</span>
        </header>
        <main className={styles.mainContent} id="main-content">
          <div className={styles.previewBanner}><Icon name="shield" /><div><strong>Akun dan peran terhubung · modul akademik masih MVP</strong><span>Peran aktif: {roleDefinition.label}. Pengguna & Akses tersimpan di Supabase; kartu, kalender, RPS, keputusan, dan metrik akademik lain masih memakai data contoh sampai fase persistensi berikutnya.</span></div><button onClick={() => notify("Lihat docs/DASHBOARD_MVP.md untuk batas implementasi yang sedang aktif.")} type="button">Tentang MVP</button></div>
          {renderScreen()}
        </main>
      </div>
      <output aria-live="polite" className={cx(styles.toast, toast && styles.toastVisible)}>{toast}</output>
    </div>
  );
}
