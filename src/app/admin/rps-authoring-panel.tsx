"use client";

import {
  rpsAuthoringExample,
  rpsPolicyExample,
  validateRpsDraft,
} from "@/lib/mvp/rps-authoring";
import { rpsTemplateManifest } from "@/lib/rps/template-manifest";
import styles from "./dashboard.module.css";

type RpsAuthoringPanelProps = {
  uploadedFile: string;
  onFileSelected: (file: File) => void;
  onNotify: (message: string) => void;
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function RpsAuthoringPanel({ uploadedFile, onFileSelected, onNotify }: RpsAuthoringPanelProps) {
  const draft = rpsAuthoringExample;
  const policy = rpsPolicyExample;
  const validation = validateRpsDraft(draft, policy);
  const passedCount = validation.filter((item) => item.status === "passed").length;
  const blockerCount = validation.filter((item) => item.status === "blocked").length;
  const assessmentTotal = draft.assessments.reduce((sum, item) => sum + item.weight, 0);
  const shortChecksum = `${rpsTemplateManifest.sha256.slice(0, 12)}…${rpsTemplateManifest.sha256.slice(-8)}`;

  return (
    <div className={styles.workspaceGrid}>
      <section className={cx(styles.card, styles.fullWidth, styles.templateContract)}>
        <div className={styles.templateContractMain}>
          <div aria-hidden="true" className={styles.docxMark}>DOCX</div>
          <div>
            <p className={styles.eyebrow}>Format resmi · sumber immutable</p>
            <h2>{rpsTemplateManifest.displayName}</h2>
            <p>
              {rpsTemplateManifest.pageCount} halaman · {rpsTemplateManifest.tableCount} tabel · {rpsTemplateManifest.sections.length} bagian dokumen · versi {rpsTemplateManifest.templateVersion}. Data aplikasi tetap menjadi sumber kanonik; DOCX dipakai sebagai kontrak impor/ekspor.
            </p>
            <dl className={styles.templateMeta}>
              <div><dt>SHA-256</dt><dd title={rpsTemplateManifest.sha256}>{shortChecksum}</dd></div>
              <div><dt>Model input</dt><dd>Placeholder tabel</dd></div>
              <div><dt>Integritas</dt><dd>Byte-for-byte terverifikasi</dd></div>
            </dl>
          </div>
        </div>
        <div className={styles.templateActions}>
          <a className={styles.primaryButton} download={rpsTemplateManifest.sourceFileName} href={rpsTemplateManifest.publicHref}>Unduh template DOCX</a>
          <label className={cx(styles.secondaryButton, styles.fileButton)}>
            Pilih DOCX terisi
            <input
              accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              aria-describedby="rps-import-help"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) onFileSelected(file);
                event.currentTarget.value = "";
              }}
              type="file"
            />
          </label>
          <small id="rps-import-help">MVP: validasi pilihan lokal saja; belum dikirim ke parser/backend.</small>
        </div>
      </section>

      <section className={cx(styles.card, styles.spanTwo, styles.rpsEditor)}>
        <div className={styles.sectionHeading}>
          <div>
            <h2>RPS & Alignment</h2>
            <p>Enam langkah mengikuti konsep Level 2 dan urutan format DOCX resmi.</p>
          </div>
          <span className={cx(styles.badge, blockerCount ? styles.tone_red : styles.tone_green)}>{blockerCount ? `${blockerCount} blocker` : "Struktur siap"}</span>
        </div>

        <ol className={styles.rpsSteps}>
          <li className={styles.rpsStep}>
            <div className={styles.rpsStepNumber}>01</div>
            <div className={styles.rpsStepContent}>
              <div className={styles.rpsStepHeading}><div><h3>Identitas Mata Kuliah</h3><p>Halaman 1 · data dasar dan otorisasi</p></div><span className={cx(styles.badge, styles.tone_green)}>✓ Lengkap</span></div>
              <dl className={styles.identityGrid}>
                <div><dt>Mata kuliah</dt><dd>{draft.identity.courseCode} · {draft.identity.courseName}</dd></div>
                <div><dt>SKS / Semester</dt><dd>{draft.identity.credits} SKS · Semester {draft.identity.semester}</dd></div>
                <div><dt>Program studi</dt><dd>{draft.identity.program}</dd></div>
                <div><dt>Dosen pengampu</dt><dd>{draft.identity.lecturer}</dd></div>
              </dl>
              <p className={styles.rpsNarrative}>{draft.identity.description}</p>
            </div>
          </li>

          <li className={styles.rpsStep}>
            <div className={styles.rpsStepNumber}>02</div>
            <div className={styles.rpsStepContent}>
              <div className={styles.rpsStepHeading}><div><h3>Capaian Pembelajaran</h3><p>CPL dibebankan, CPMK, dan Sub-CPMK</p></div><span className={cx(styles.badge, styles.tone_green)}>✓ Terpetakan</span></div>
              <div className={styles.outcomeSummary}>
                <div><strong>{draft.cpl.length}</strong><span>CPL</span></div>
                <div><strong>{draft.cpmk.length}</strong><span>CPMK</span></div>
                <div><strong>{draft.subCpmk.length}</strong><span>Sub-CPMK</span></div>
              </div>
              <div className={styles.rpsOutcomeList}>
                {draft.cpmk.map((item) => <article key={item.code}><span>{item.code}</span><div><strong>{item.statement}</strong><small>{item.bloom} · {item.cplCodes.join(", ")}</small></div></article>)}
              </div>
            </div>
          </li>

          <li className={styles.rpsStep}>
            <div className={styles.rpsStepNumber}>03</div>
            <div className={styles.rpsStepContent}>
              <div className={styles.rpsStepHeading}><div><h3>Alignment OBE</h3><p>CPL → CPMK → Sub-CPMK → bukti asesmen</p></div><span className={cx(styles.badge, styles.tone_green)}>✓ Relasi valid</span></div>
              <div className={styles.alignmentRows}>
                {draft.cpl.map((cpl) => {
                  const mappedCpmk = draft.cpmk.filter((cpmk) => cpmk.cplCodes.includes(cpl.code));
                  return <article key={cpl.code}><strong>{cpl.code}</strong><span aria-hidden="true">→</span><div>{mappedCpmk.map((cpmk) => <em key={cpmk.code}>{cpmk.code}</em>)}</div></article>;
                })}
              </div>
              <p className={styles.rpsNarrative}>Pemeriksaan hanya menilai kelengkapan dan integritas relasi. Kualitas rumusan tetap ditelaah manusia.</p>
            </div>
          </li>

          <li className={styles.rpsStep}>
            <div className={styles.rpsStepNumber}>04</div>
            <div className={styles.rpsStepContent}>
              <div className={styles.rpsStepHeading}><div><h3>Asesmen & Metode</h3><p>Bobot, outcome yang diukur, dan bukti</p></div><span className={cx(styles.badge, assessmentTotal === policy.assessmentWeightTotal ? styles.tone_green : styles.tone_red)}>Total {assessmentTotal}%</span></div>
              <div className={styles.compactTableWrap}>
                <table><thead><tr><th>Asesmen</th><th>Bobot</th><th>CPMK</th><th>Bukti</th></tr></thead><tbody>{draft.assessments.map((item) => <tr key={item.code}><td><strong>{item.title}</strong><small>{item.code}</small></td><td>{item.weight}%</td><td>{item.cpmkCodes.join(", ")}</td><td>{item.evidence}</td></tr>)}</tbody></table>
              </div>
            </div>
          </li>

          <li className={styles.rpsStep}>
            <div className={styles.rpsStepNumber}>05</div>
            <div className={styles.rpsStepContent}>
              <div className={styles.rpsStepHeading}><div><h3>Rencana Pembelajaran Mingguan</h3><p>Jumlah pertemuan mengikuti snapshot kebijakan aktif</p></div><span className={cx(styles.badge, styles.tone_green)}>{draft.weeklyPlan.length}/{policy.expectedMeetingCount}</span></div>
              <div className={styles.weekPlanPreview}>
                {draft.weeklyPlan.slice(0, 4).map((meeting) => <article key={meeting.week}><span>M{meeting.week}</span><div><strong>{meeting.topic}</strong><small>{meeting.subCpmkCodes.join(", ")} · {meeting.method}</small></div></article>)}
              </div>
              <button className={styles.textButton} onClick={() => onNotify(`Simulasi—${draft.weeklyPlan.length} pertemuan siap dibuka di editor mingguan.`)} type="button">Lihat seluruh {draft.weeklyPlan.length} pertemuan →</button>
            </div>
          </li>
        </ol>
      </section>

      <aside className={styles.stack}>
        <section className={styles.card}>
          <div className={styles.sectionHeading}><div><h2>Validasi RPS</h2><p>Rules-only · dapat dijelaskan</p></div><span className={cx(styles.badge, blockerCount ? styles.tone_red : styles.tone_green)}>{passedCount}/{validation.length} lolos</span></div>
          <div className={styles.rpsValidationList}>
            {validation.map((item) => <article key={item.id}><i className={cx(styles.rpsValidationIcon, item.status === "passed" ? styles.tone_green : item.status === "blocked" ? styles.tone_red : styles.tone_amber)}>{item.status === "passed" ? "✓" : "!"}</i><div><strong>{item.label}</strong><p>{item.detail}</p><small>Rule: {item.id}</small></div></article>)}
          </div>
        </section>

        <section className={styles.card}>
          <div className={styles.sectionHeading}><div><h2>Kebijakan efektif</h2><p>Sumber angka dan ambang</p></div></div>
          <dl className={styles.policyList}>
            <div><dt>Snapshot</dt><dd>{policy.label}</dd></div>
            <div><dt>Berlaku sejak</dt><dd>{policy.effectiveFrom}</dd></div>
            <div><dt>Pertemuan</dt><dd>{policy.expectedMeetingCount}</dd></div>
            <div><dt>Target capaian</dt><dd>{policy.attainmentTarget}%</dd></div>
          </dl>
          <p className={styles.rpsNarrative}>Angka di atas milik kebijakan contoh prodi-periode, bukan default universal aplikasi.</p>
        </section>

        <section className={cx(styles.card, styles.neutralityCard)}>
          <span className={cx(styles.badge, styles.tone_blue)}>Batas keputusan</span>
          <h2>Netral dan human-in-the-loop</h2>
          <p>Validator tidak membaca atribut pribadi. AI hanya memberi saran; Dosen menerima perubahan, GPM menelaah, dan Kaprodi mengesahkan. Self-approval dilarang.</p>
        </section>

        <section className={styles.card}>
          <div className={styles.sectionHeading}><div><h2>Sumber dokumen lokal</h2><p>Belum diunggah atau diproses</p></div></div>
          <p className={styles.sourceFile}><span aria-hidden="true">▣</span> {uploadedFile}</p>
        </section>
      </aside>
    </div>
  );
}
