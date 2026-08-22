import "server-only";
import mammoth from "mammoth";
import { extractText, getDocumentProxy } from "unpdf";

export type ParsedSource = {
  text: string;
  format: "docx" | "pdf" | "text";
  metadata: Record<string, unknown>;
  warnings: string[];
};

export class ParserLimitError extends Error {
  readonly requiresEnhancedParser = true;
}

function timeout<T>(promise: Promise<T>, milliseconds: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const limited = Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      timer = setTimeout(
        () => reject(new ParserLimitError("Parsing exceeded the free-tier time limit.")),
        milliseconds,
      );
    }),
  ]);

  return limited.finally(() => {
    if (timer) clearTimeout(timer);
  });
}

export async function parseServerlessDocument(filename: string, buffer: Buffer): Promise<ParsedSource> {
  const extension = filename.toLowerCase().split(".").pop();
  const timeoutMs = Number(process.env.SERVERLESS_PARSER_TIMEOUT_MS ?? 45_000);

  if (extension === "docx") {
    const result = await timeout(mammoth.extractRawText({ buffer }), timeoutMs);
    return {
      text: result.value.trim(),
      format: "docx",
      metadata: { characters: result.value.length },
      warnings: result.messages.map((message) => message.message),
    };
  }

  if (extension === "pdf") {
    const pdf = await timeout(
      getDocumentProxy(new Uint8Array(buffer), { maxImageSize: 16_777_216 }),
      timeoutMs,
    );

    try {
      const maxPages = Number(process.env.SERVERLESS_PARSER_MAX_PAGES ?? 80);
      if (pdf.numPages > maxPages) {
        throw new ParserLimitError(`PDF has ${pdf.numPages} pages; the free-tier limit is ${maxPages}.`);
      }

      const result = await timeout(extractText(pdf, { mergePages: true }), timeoutMs);
      const text = typeof result.text === "string" ? result.text : result.text.join("\n\n");
      return {
        text: text.trim(),
        format: "pdf",
        metadata: { characters: text.length, pages: result.totalPages },
        warnings: text.trim().length < 100
          ? ["Very little text was found. The PDF may be scanned and need OCR on the enhanced parser."]
          : [],
      };
    } finally {
      await pdf.destroy();
    }
  }

  if (["txt", "md", "html", "htm"].includes(extension ?? "")) {
    const text = new TextDecoder("utf-8", { fatal: false }).decode(buffer).trim();
    return { text, format: "text", metadata: { characters: text.length }, warnings: [] };
  }

  throw new ParserLimitError(
    "The free parser supports PDF, DOCX, TXT, Markdown, and HTML. ZIP, legacy Office, and OCR require the enhanced parser.",
  );
}
