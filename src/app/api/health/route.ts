import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const services = {
    supabase: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
    openai: Boolean(process.env.OPENAI_API_KEY),
    parser: Boolean(process.env.PARSER_SERVICE_URL),
  };

  return NextResponse.json({
    status: Object.values(services).every(Boolean) ? "ready" : "configuration_required",
    services,
    timestamp: new Date().toISOString(),
  });
}

