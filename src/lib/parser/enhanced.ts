import "server-only";
import type { ParsedSource } from "./serverless";

type EnhancedResponse = {
  parser_version: string;
  source_filename: string;
  merged_markdown: string;
  documents: Array<{ filename: string; characters: number }>;
  warnings: string[];
};

export async function parseWithEnhancedService(filename: string, source: Blob): Promise<ParsedSource> {
  const serviceUrl = process.env.PARSER_SERVICE_URL;
  if (!serviceUrl) throw new Error("PARSER_SERVICE_URL is not configured.");

  const form = new FormData();
  form.append("file", source, filename);

  const headers = new Headers();
  if (process.env.PARSER_SERVICE_TOKEN) {
    headers.set("authorization", `Bearer ${process.env.PARSER_SERVICE_TOKEN}`);
  }

  const response = await fetch(new URL("/parse", serviceUrl), {
    method: "POST",
    body: form,
    headers,
    signal: AbortSignal.timeout(180_000),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Enhanced parser returned ${response.status}: ${detail.slice(0, 500)}`);
  }

  const result = (await response.json()) as EnhancedResponse;
  return {
    text: result.merged_markdown.trim(),
    format: "text",
    metadata: {
      parserVersion: result.parser_version,
      files: result.documents,
    },
    warnings: result.warnings,
  };
}
