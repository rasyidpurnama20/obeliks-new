import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { DashboardEntry } from "../../dashboard-entry";
import type { NavigationItemId } from "@/lib/mvp/types";

const allowed: Record<string, Set<string>> = {
  "institusi-periode": new Set(["kelola-institusi", "periode-aktif", "kurikulum-inspector"]),
  "monitoring-rps": new Set(["penyusunan", "evaluasi"]),
};

const titles: Record<string, string> = {
  "kelola-institusi": "Kelola Institusi",
  "periode-aktif": "Periode Aktif",
  "kurikulum-inspector": "Kurikulum Inspector",
  penyusunan: "Penyusunan RPS Inspector",
  evaluasi: "Evaluasi RPS Inspector",
};

export async function generateMetadata({ params }: { params: Promise<{ screen: string; subview: string }> }): Promise<Metadata> {
  const { screen, subview } = await params;
  if (!allowed[screen]?.has(subview)) return {};
  return { title: `${titles[subview] ?? "OBELIKS"} — OBELIKS APPS` };
}

export default async function DashboardSubviewPage({ params }: { params: Promise<{ screen: string; subview: string }> }) {
  const { screen, subview } = await params;
  if (screen === "institusi-periode" && subview === "set-periode-aktif") redirect("/institusi-periode/periode-aktif");
  if (!allowed[screen]?.has(subview)) notFound();
  return <DashboardEntry initialScreen={screen as NavigationItemId} />;
}
