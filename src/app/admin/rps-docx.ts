"use client";

import type { RpsStudioState } from "./rps-studio-model";

const WORD_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const encoder = new TextEncoder();

function xml(value: unknown) {
  return String(value ?? "").replace(/[&<>]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[character] ?? character);
}
function safeName(value: string) { return value.trim().replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "") || "RPS-OBE"; }
function u16(value: number) { return [value & 255, (value >>> 8) & 255]; }
function u32(value: number) { return [value & 255, (value >>> 8) & 255, (value >>> 16) & 255, (value >>> 24) & 255]; }

function crc32(data: Uint8Array) {
  const cache = crc32 as typeof crc32 & { table?: Uint32Array };
  if (!cache.table) {
    cache.table = new Uint32Array(256);
    for (let index = 0; index < 256; index += 1) {
      let current = index;
      for (let bit = 0; bit < 8; bit += 1) current = (current & 1) ? 0xedb88320 ^ (current >>> 1) : current >>> 1;
      cache.table[index] = current >>> 0;
    }
  }
  let value = 0xffffffff;
  for (const byte of data) value = cache.table[(value ^ byte) & 255] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}

function concat(parts: Uint8Array[]) {
  const total = parts.reduce((sum, part) => sum + part.byteLength, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) { output.set(part, offset); offset += part.byteLength; }
  return output;
}

function zipStore(files: Record<string, string>) {
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  const now = new Date();
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
  const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  for (const [name, content] of Object.entries(files)) {
    const nameBytes = encoder.encode(name);
    const data = encoder.encode(content);
    const crc = crc32(data);
    const localHeader = new Uint8Array([80,75,3,4,20,0,0,0,0,0,...u16(dosTime),...u16(dosDate),...u32(crc),...u32(data.length),...u32(data.length),...u16(nameBytes.length),0,0]);
    const local = concat([localHeader, nameBytes, data]);
    locals.push(local);
    const centralHeader = new Uint8Array([80,75,1,2,20,0,20,0,0,0,0,0,...u16(dosTime),...u16(dosDate),...u32(crc),...u32(data.length),...u32(data.length),...u16(nameBytes.length),0,0,0,0,0,0,0,0,0,0,0,0,...u32(offset)]);
    centrals.push(concat([centralHeader, nameBytes]));
    offset += local.byteLength;
  }
  const centralSize = centrals.reduce((sum, item) => sum + item.byteLength, 0);
  const end = new Uint8Array([80,75,5,6,0,0,0,0,...u16(centrals.length),...u16(centrals.length),...u32(centralSize),...u32(offset),0,0]);
  const archive = concat([...locals, ...centrals, end]);
  return new Blob([archive.buffer], { type: WORD_MIME });
}

function run(text: unknown, bold = false, size = 18) { return `<w:r><w:rPr>${bold ? "<w:b/>" : ""}<w:sz w:val="${size}"/><w:szCs w:val="${size}"/></w:rPr><w:t xml:space="preserve">${xml(text)}</w:t></w:r>`; }
function paragraph(text: unknown, options: { bold?: boolean; size?: number; align?: "left" | "center" | "right"; after?: number } = {}) { return `<w:p><w:pPr>${options.align ? `<w:jc w:val="${options.align}"/>` : ""}<w:spacing w:after="${options.after ?? 50}"/></w:pPr>${run(text, options.bold, options.size ?? 18)}</w:p>`; }
function heading(text: string, level = 1) { return paragraph(text, { bold: true, size: level === 1 ? 28 : level === 2 ? 22 : 19, after: level === 1 ? 90 : 65 }); }
function list(items: string[]) { return items.length ? items.map((item) => paragraph(`• ${item}`, { size: 16, after: 20 })).join("") : paragraph("—", { size: 16 }); }

function table(headers: string[], rows: Array<Array<unknown>>) {
  const width = Math.max(700, Math.floor(10000 / Math.max(1, headers.length)));
  const rowXml = (cells: Array<unknown>, header = false) => `<w:tr>${cells.map((cell) => `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/>${header ? '<w:shd w:fill="E6ECEF"/>' : ""}</w:tcPr><w:p><w:pPr><w:spacing w:after="0"/></w:pPr>${run(cell, header, 15)}</w:p></w:tc>`).join("")}</w:tr>`;
  return `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblBorders><w:top w:val="single" w:sz="4" w:color="7C8B95"/><w:left w:val="single" w:sz="4" w:color="7C8B95"/><w:bottom w:val="single" w:sz="4" w:color="7C8B95"/><w:right w:val="single" w:sz="4" w:color="7C8B95"/><w:insideH w:val="single" w:sz="3" w:color="B7C1C8"/><w:insideV w:val="single" w:sz="3" w:color="B7C1C8"/></w:tblBorders></w:tblPr><w:tblGrid>${headers.map(() => `<w:gridCol w:w="${width}"/>`).join("")}</w:tblGrid>${rowXml(headers, true)}${rows.map((row) => rowXml(row)).join("")}</w:tbl>`;
}

function documentXml(state: RpsStudioState) {
  const cplMatrix = state.cpmk.map((cpmk) => [cpmk.code, ...state.cpl.map((cpl) => cpmk.maps[cpl.id] ?? 0), `${cpmk.weight}%`]);
  let body = paragraph("RENCANA PEMBELAJARAN SEMESTER (RPS)", { bold: true, size: 30, align: "center", after: 30 });
  body += paragraph("OUTCOME-BASED EDUCATION", { bold: true, size: 20, align: "center", after: 120 });
  body += table(["Field", "Isi"], [["Institusi",state.meta.institution],["Fakultas",state.meta.faculty],["Program Studi",state.meta.program],["Mata Kuliah",state.meta.courseName],["Course Name",state.meta.courseNameEn],["Kode",state.meta.code],["KBK",state.meta.kbk],["SKS",state.meta.credits],["Semester",state.meta.semester || "—"],["Periode/Review",state.meta.review]]);
  body += heading("Deskripsi Mata Kuliah", 2) + paragraph(state.meta.descriptionId || "—", { size: 16 });
  if (state.meta.descriptionEn) body += paragraph(state.meta.descriptionEn, { size: 16 });
  body += heading("1. CPL yang Dibebankan pada Mata Kuliah", 2) + table(["Kode","Deskripsi","English"], state.cpl.map((item) => [item.code,item.description,item.english]));
  body += heading("2. CPMK dan Alignment CPL", 2) + table(["Kode","CPMK","Bobot"], state.cpmk.map((item) => [item.code,item.text,`${item.weight}%`]));
  body += heading("Matriks CPL–CPMK", 3) + table(["CPMK",...state.cpl.map((item) => item.code),"Bobot"], cplMatrix);
  body += heading("Sub-CPMK", 3) + table(["Kode","CPMK","Pernyataan","Bloom"], state.subCpmk.map((item) => [item.code,state.cpmk.find((cpmk) => cpmk.id === item.cpmkId)?.code ?? "—",item.text,item.level]));
  body += heading("3. Jadwal dan Bahan Kajian", 2) + table(["Minggu","CPMK","Sub-CPMK","Topik","Subtopik","Metode","Media","Asesmen"], state.schedule.map((row) => [row.week,state.cpmk.find((item) => item.id === row.cpmkId)?.code ?? "—",state.subCpmk.find((item) => item.id === row.subCpmkId)?.code ?? "—",row.topic,row.subtopic,row.method,row.media,row.assessment]));
  body += heading("4. Rencana Evaluasi", 2) + table(["Asesmen","Bobot","CPMK","Catatan"], state.evaluations.map((item) => [item.name,`${item.weight}%`,item.cpmkIds.map((id) => state.cpmk.find((cpmk) => cpmk.id === id)?.code).filter(Boolean).join(", "),item.notes]));
  body += heading("5. Rubrik", 2) + table(["Kriteria","CPMK","Bobot","4","3","2","1"], state.rubrics.map((item) => [item.criterion,state.cpmk.find((cpmk) => cpmk.id === item.cpmkId)?.code ?? "—",`${item.weight}%`,item.level4,item.level3,item.level2,item.level1]));
  body += heading("Assessment Evidence", 3) + table(["Kode","Asesmen","CPMK","Tipe","Lokasi","Semester","Status"], state.evidence.map((item) => [item.code,item.assessment,state.cpmk.find((cpmk) => cpmk.id === item.cpmkId)?.code ?? "—",item.type,item.location,item.semester,item.status]));
  body += heading("6. Attainment", 2) + table(["CPMK","Target Nilai","Target Mahasiswa","Mean","Tercapai","Catatan"], state.attainment.map((item) => [state.cpmk.find((cpmk) => cpmk.id === item.cpmkId)?.code ?? "—",item.targetScore,`${item.targetStudents}%`,item.mean ?? "—",item.achievedStudents == null ? "—" : `${item.achievedStudents}%`,item.notes]));
  body += heading("7. Continuous Improvement", 2) + table(["Outcome","Finding","Evidence","Root Cause","Action","PIC","Status"], state.improvements.map((item) => [item.outcome,item.finding,item.evidence,item.rootCause,item.action,item.pic,item.status]));
  body += heading("8. Curriculum Context", 2) + table(["Program","Kurikulum","I-R-M"], [[state.curriculumContext.program,state.curriculumContext.curriculum,state.curriculumContext.currentRole]]);
  body += heading("Referensi Utama", 2) + list(state.references.main) + heading("Referensi Tambahan", 2) + list(state.references.additional);
  body += heading("Validasi", 2) + table(["Peran","Nama","ID"], [["Penyusun",state.validation.author,state.validation.authorId],["Koordinator",state.validation.coordinator,state.validation.coordinatorId],["Kaprodi",state.validation.head,state.validation.headId]]);
  body += paragraph(`Verification: ${state.audit.reverified ? `${state.audit.verifiedAt} · ${state.audit.hash}` : "Belum terverifikasi"}`, { size: 14 });
  body += `<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="700" w:right="650" w:bottom="700" w:left="650"/></w:sectPr>`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`;
}

export function buildRpsDocx(state: RpsStudioState) {
  const now = new Date().toISOString();
  const files = {
    "[Content_Types].xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`,
    "_rels/.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`,
    "word/document.xml": documentXml(state),
    "word/_rels/document.xml.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`,
    "docProps/core.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xml(state.meta.courseName || "RPS OBE")}</dc:title><dc:creator>OBELIKS RPS OBE Studio</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created></cp:coreProperties>`,
    "docProps/app.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>OBELIKS RPS OBE Studio</Application></Properties>`,
  };
  return { blob: zipStore(files), filename: `${safeName(state.meta.courseName || state.meta.code || "RPS-OBE")}.docx` };
}

export function downloadRpsDocx(state: RpsStudioState) {
  const { blob, filename } = buildRpsDocx(state);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = filename; document.body.appendChild(anchor); anchor.click();
  window.setTimeout(() => { URL.revokeObjectURL(url); anchor.remove(); }, 1000);
}

export { WORD_MIME };
