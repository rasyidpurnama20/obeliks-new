import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Masuk — OBELIKS APPS",
  description: "Penyusunan, ekstraksi, dan validasi RPS berbasis OBE.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
