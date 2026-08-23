import { NextResponse } from "next/server";
import { z } from "zod";
import { extractRps } from "@/lib/ai/extract-rps";
import { AccessError, assertOrganizationMember, authenticateRequest } from "@/lib/auth/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const requestSchema = z.object({
  documentId: z.string().uuid(),
  normalizedText: z.string().min(100).max(120_000),
});

export async function POST(request: Request) {
  try {
    if (process.env.AI_MODE !== "openai" || !process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        {
          error: "ai_disabled",
          message: "Rules-only mode is active. Configure AI_MODE=openai and an API key to enable extraction.",
        },
        { status: 503 },
      );
    }

    const payload = requestSchema.parse(await request.json());
    const { supabase, user } = await authenticateRequest(request);

    const { data: document, error: documentError } = await supabase
      .from("rps_documents")
      .select("organization_id")
      .eq("id", payload.documentId)
      .maybeSingle();

    if (documentError) throw documentError;
    if (!document) {
      return NextResponse.json({ error: "document_not_found" }, { status: 404 });
    }

    await assertOrganizationMember(supabase, document.organization_id, user.id);

    const extraction = await extractRps(payload.normalizedText);

    const { error } = await supabase
      .from("rps_documents")
      .update({
        structured_data: extraction,
        validation_summary: { issues: extraction.issues },
        status: "review",
        updated_at: new Date().toISOString(),
      })
      .eq("id", payload.documentId);

    if (error) throw error;
    return NextResponse.json({ data: extraction });
  } catch (error) {
    if (error instanceof AccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "invalid_request", details: error.issues }, { status: 400 });
    }

    const message = error instanceof Error ? error.message : "Unexpected extraction error.";
    return NextResponse.json({ error: "extraction_failed", message }, { status: 500 });
  }
}
