import "server-only";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { rpsExtractionSchema, type RpsExtraction } from "./rps-schema";

const SYSTEM_INSTRUCTION = `Anda mengekstrak dokumen RPS berbahasa Indonesia ke struktur OBE.
Gunakan hanya informasi yang benar-benar ada pada dokumen. Jika field identitas tidak ditemukan, isi null.
Confidence harus 0 sampai 1. Jangan mengarang relasi CPL/CPMK.
Catat inkonsistensi, field hilang, total bobot, atau durasi yang meragukan pada issues.
Kembalikan deskripsi sebagaimana makna dokumen sumber, tanpa memperluas substansi.`;

export async function extractRps(normalizedDocument: string): Promise<RpsExtraction> {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured.");

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await openai.responses.parse({
    model: process.env.OPENAI_EXTRACTION_MODEL ?? "gpt-5.6-terra",
    input: [
      { role: "system", content: SYSTEM_INSTRUCTION },
      { role: "user", content: normalizedDocument },
    ],
    text: { format: zodTextFormat(rpsExtractionSchema, "rps_extraction") },
  });

  if (!response.output_parsed) throw new Error("Model did not return a parsed RPS extraction.");
  return response.output_parsed;
}

