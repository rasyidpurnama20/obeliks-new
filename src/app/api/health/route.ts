import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const aiMode = process.env.AI_MODE === "openai" ? "openai" : "disabled";
  const services = {
    supabase: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
    rules: true,
    openai: aiMode === "openai" && Boolean(process.env.OPENAI_API_KEY),
    serverlessParser: true,
    enhancedParser: Boolean(process.env.PARSER_SERVICE_URL),
  };

  return NextResponse.json({
    status: services.supabase ? "ready" : "configuration_required",
    aiMode,
    services,
    timestamp: new Date().toISOString(),
  });
}
