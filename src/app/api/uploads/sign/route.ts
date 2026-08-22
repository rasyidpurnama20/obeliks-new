import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { AccessError, assertOrganizationMember, authenticateRequest } from "@/lib/auth/server";

export const runtime = "nodejs";

const requestSchema = z.object({
  organizationId: z.string().uuid(),
  courseId: z.string().uuid().nullable().optional(),
  academicYear: z.string().max(32).nullable().optional(),
  filename: z.string().min(1).max(180),
});

function safeFilename(filename: string): string {
  return filename
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(-120) || "document";
}

export async function POST(request: Request) {
  let documentId: string | undefined;
  try {
    const payload = requestSchema.parse(await request.json());
    const { supabase, user } = await authenticateRequest(request);
    await assertOrganizationMember(supabase, payload.organizationId, user.id);

    const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? "rps-source";
    const path = `${payload.organizationId}/${user.id}/${randomUUID()}-${safeFilename(payload.filename)}`;

    const { data: document, error: documentError } = await supabase
      .from("rps_documents")
      .insert({
        organization_id: payload.organizationId,
        course_id: payload.courseId ?? null,
        created_by: user.id,
        academic_year: payload.academicYear ?? null,
        status: "queued",
        source_path: path,
      })
      .select("id")
      .single();

    if (documentError) throw documentError;
    documentId = document.id;

    const { data: signed, error: signedError } = await supabase.storage
      .from(bucket)
      .createSignedUploadUrl(path, { upsert: false });

    if (signedError) {
      await supabase.from("rps_documents").delete().eq("id", documentId);
      throw signedError;
    }

    return NextResponse.json({
      bucket,
      documentId,
      path: signed.path,
      token: signed.token,
      uploadUrl: signed.signedUrl,
    });
  } catch (error) {
    if (error instanceof AccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "invalid_request", details: error.issues }, { status: 400 });
    }

    const message = error instanceof Error ? error.message : "Could not prepare the upload.";
    return NextResponse.json({ error: "upload_sign_failed", message, documentId }, { status: 500 });
  }
}

