import { NextResponse } from "next/server";
import { z } from "zod";
import { AccessError, assertOrganizationMember, authenticateRequest } from "@/lib/auth/server";
import { parseWithEnhancedService } from "@/lib/parser/enhanced";
import { ParserLimitError, parseServerlessDocument, type ParsedSource } from "@/lib/parser/serverless";
import { validateRpsText } from "@/lib/validation/basic-rps";

export const runtime = "nodejs";
export const maxDuration = 60;

const requestSchema = z.object({ documentId: z.string().uuid() });

export async function POST(request: Request) {
  let documentId: string | undefined;
  try {
    const payload = requestSchema.parse(await request.json());
    documentId = payload.documentId;
    const { supabase, user } = await authenticateRequest(request);

    const { data: document, error: documentError } = await supabase
      .from("rps_documents")
      .select("id, organization_id, source_path")
      .eq("id", payload.documentId)
      .maybeSingle();

    if (documentError) throw documentError;
    if (!document?.source_path) {
      return NextResponse.json({ error: "document_or_source_not_found" }, { status: 404 });
    }

    await assertOrganizationMember(supabase, document.organization_id, user.id);
    await supabase.from("rps_documents").update({ status: "parsing" }).eq("id", document.id);

    const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? "rps-source";
    const { data: source, error: downloadError } = await supabase.storage
      .from(bucket)
      .download(document.source_path);

    if (downloadError || !source) throw downloadError ?? new Error("Source download failed.");

    const filename = document.source_path.split("/").at(-1) ?? "document";
    const maxBytes = Number(process.env.SERVERLESS_PARSER_MAX_MB ?? 10) * 1024 * 1024;
    let parserName = "serverless-node-v1";
    let parsed: ParsedSource;

    if (source.size > maxBytes) {
      if (!process.env.PARSER_SERVICE_URL) {
        throw new ParserLimitError(
          `File is ${(source.size / 1024 / 1024).toFixed(1)} MB; the free parser limit is ${maxBytes / 1024 / 1024} MB.`,
        );
      }
      parsed = await parseWithEnhancedService(filename, source);
      parserName = "enhanced-docling-v1";
    } else {
      try {
        parsed = await parseServerlessDocument(filename, Buffer.from(await source.arrayBuffer()));
      } catch (error) {
        if (!(error instanceof ParserLimitError) || !process.env.PARSER_SERVICE_URL) throw error;
        parsed = await parseWithEnhancedService(filename, source);
        parserName = "enhanced-docling-v1";
      }
    }
    const validation = validateRpsText(parsed.text);

    const { error: updateError } = await supabase
      .from("rps_documents")
      .update({
        parser_version: parserName,
        raw_extraction: {
          schemaVersion: 1,
          format: parsed.format,
          metadata: parsed.metadata,
          text: parsed.text,
          warnings: parsed.warnings,
        },
        validation_summary: validation,
        status: "review",
      })
      .eq("id", document.id);

    if (updateError) throw updateError;
    return NextResponse.json({
      documentId: document.id,
      status: "review",
      parser: parserName,
      metadata: parsed.metadata,
      warnings: parsed.warnings,
      validation,
    });
  } catch (error) {
    if (error instanceof AccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "invalid_request", details: error.issues }, { status: 400 });
    }

    if (error instanceof ParserLimitError) {
      return NextResponse.json(
        { error: "enhanced_parser_required", message: error.message, requiresEnhancedParser: true, documentId },
        { status: 422 },
      );
    }

    const message = error instanceof Error ? error.message : "Unexpected parser error.";
    return NextResponse.json({ error: "parse_failed", message, documentId }, { status: 500 });
  }
}
