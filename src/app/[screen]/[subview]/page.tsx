import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DashboardEntry } from "../../dashboard-entry";

const allowedSubviews = new Set(["kelola-institusi", "set-periode-aktif"]);

const titles: Record<string, string> = {
  "kelola-institusi": "Kelola Institusi",
  "set-periode-aktif": "Set Periode Aktif",
};

export async function generateMetadata({ params }: { params: Promise<{ screen: string; subview: string }> }): Promise<Metadata> {
  const { screen, subview } = await params;
  if (screen !== "institusi-periode" || !allowedSubviews.has(subview)) return {};
  return { title: `${titles[subview]} — OBELIKS APPS` };
}

export default async function InstitutionPeriodSubviewPage({ params }: { params: Promise<{ screen: string; subview: string }> }) {
  const { screen, subview } = await params;
  if (screen !== "institusi-periode" || !allowedSubviews.has(subview)) notFound();
  return <DashboardEntry initialScreen="institusi-periode" />;
}
