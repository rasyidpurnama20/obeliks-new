import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DashboardEntry } from "../dashboard-entry";
import { dashboardScreens } from "@/lib/navigation/routes";
import type { NavigationItemId } from "@/lib/mvp/types";

const titles: Record<NavigationItemId, string> = {
  dashboard: "Dashboard",
  "institusi-periode": "Institusi & Periode",
  "pengguna-akses": "Pengguna & Akses",
  "monitoring-rps": "Monitoring RPS",
  "pengajaran-saya": "Pengajaran Saya",
  "rps-saya": "RPS Saya",
  "ai-parser": "AI & Parser",
  "audit-log": "Audit Log",
  pengaturan: "Pengaturan",
};

export async function generateMetadata({ params }: { params: Promise<{ screen: string }> }): Promise<Metadata> {
  const { screen } = await params;
  if (!dashboardScreens.includes(screen as NavigationItemId)) return {};
  return { title: `${titles[screen as NavigationItemId]} — OBELIKS APPS` };
}

export default async function DashboardScreenPage({ params }: { params: Promise<{ screen: string }> }) {
  const { screen } = await params;
  if (!dashboardScreens.includes(screen as NavigationItemId)) notFound();
  return <DashboardEntry initialScreen={screen as NavigationItemId} />;
}
