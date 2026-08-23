"use client";

import { useEffect, useState } from "react";
import styles from "./clean-workspace.module.css";

function currentPath() {
  return typeof window === "undefined" ? "" : window.location.pathname.replace(/\/$/, "") || "/";
}

export function MinimalDashboardPanel({ displayName, email }: { displayName?: string | null; email: string }) {
  const [path, setPath] = useState("");

  useEffect(() => {
    const sync = () => setPath(currentPath());
    sync();
    window.addEventListener("popstate", sync);
    window.addEventListener("obeliks:navigation", sync);
    return () => {
      window.removeEventListener("popstate", sync);
      window.removeEventListener("obeliks:navigation", sync);
    };
  }, []);

  if (path !== "/dashboard") return null;
  const name = displayName?.trim() || email.split("@")[0] || "Pengguna";

  return (
    <div className={styles.overlay} data-clean-workspace="dashboard">
      <main className={styles.page}>
        <section className={styles.hero}>
          <div>
            <h2>Selamat Datang, {name}</h2>
          </div>
        </section>
      </main>
    </div>
  );
}
